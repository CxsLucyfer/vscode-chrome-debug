/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import URI from 'vscode-uri';
import { TestProjectSpec } from '../framework/frameworkTestSupport';
import { IFixture } from './fixture';
import { DefaultFixture } from './defaultFixture';
import { LaunchWebServer } from './launchWebServer';
import { LaunchPuppeteer } from '../puppeteer/launchPuppeteer';
import { ExtendedDebugClient } from 'vscode-chrome-debug-core-testsupport';
import { Page, Browser } from 'puppeteer';
import { ITestCallbackContext, IBeforeAndAfterContext } from 'mocha';
import { PausedWizard } from '../wizards/pausedWizard';

/** Perform all the steps neccesary to launch a particular project such as:
 *    - Default fixture/setup
 *    - Launch web-server
 *    - Connect puppeteer to Chrome
 */
export class LaunchProject implements IFixture {
    private constructor(
        private readonly _defaultFixture: DefaultFixture,
        private readonly _launchWebServer: LaunchWebServer,
        public readonly pausedWizard: PausedWizard,
        private readonly _launchPuppeteer: LaunchPuppeteer) { }

    public static async create(testContext: IBeforeAndAfterContext | ITestCallbackContext, testSpec: TestProjectSpec): Promise<LaunchProject> {
        const launchWebServer = await LaunchWebServer.launch(testSpec);
        const defaultFixture = await DefaultFixture.create(testContext);

        // We need to create the PausedWizard before launching the debuggee to listen to all events and avoid race conditions
        const pausedWizard = PausedWizard.forClient(defaultFixture.debugClient);

        const launchPuppeteer = await LaunchPuppeteer.create(defaultFixture.debugClient, launchWebServer.launchConfig);
        return new LaunchProject(defaultFixture, launchWebServer, pausedWizard, launchPuppeteer);
    }

    /** Client for the debug adapter being used for this test */
    public get debugClient(): ExtendedDebugClient {
        return this._defaultFixture.debugClient;
    }

    /** Object to control the debugged browser via puppeteer */
    public get browser(): Browser {
        return this._launchPuppeteer.browser;
    }

    /** Object to control the debugged page via puppeteer */
    public get page(): Page {
        return this._launchPuppeteer.page;
    }

    public get url(): URI {
        return this._launchWebServer.url;
    }

    public async cleanUp(): Promise<void> {
        this.pausedWizard.assertNoMoreEvents();
        await this._defaultFixture.cleanUp(); // Disconnect the debug-adapter first
        await this._launchPuppeteer.cleanUp(); // Then disconnect puppeteer and close chrome
        await this._launchWebServer.cleanUp(); // Finally disconnect the web-server
    }
}
