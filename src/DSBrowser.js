import SDOAdapter from 'schema-org-adapter';

import Util from './Util';
import DSHandler from './DSHandler';

import ListRenderer from './ListRenderer';
import DSRenderer from './DSRenderer';
import NativeRenderer from './NativeRenderer';
import TreeRenderer from './TreeRenderer';
import TableRenderer from './TableRenderer';

const BROWSER_TYPES = {
    DS: 'DS',
    LIST: 'LIST'
};

class DSBrowser {
    constructor(elem, dsOrList, type = BROWSER_TYPES.DS) {
        this.elem = elem;
        this.dsOrList = dsOrList;
        this.type = type;

        this.path = null;

        this.util = new Util(this);
        this.dsHandler = new DSHandler(this);

        this.listRenderer = new ListRenderer(this);
        this.dsRenderer = new DSRenderer(this);
        this.nativeRenderer = new NativeRenderer(this);
        this.treeRenderer = new TreeRenderer(this);
        this.tableRenderer = new TableRenderer(this);

        window.addEventListener('popstate', async () => {
            await this.render();
        });
    }

    async render() {
        this.elem.innerHTML =
            '<div style="text-align: center">' +
            '<img src="https://raw.githubusercontent.com/YarnSeemannsgarn/ds-browser/main/images/loading.gif"' +
            ' alt="Loading Animation" style="margin-top: 6px;">' +
            '</div>';

        await this.init();

        if (this.isShaclRendering()) {
            this.dsRenderer.renderShacl();
        } else if (this.isNativeRendering()) {
            this.nativeRenderer.render();
        } else if (this.isTreeRendering()) {
            this.treeRenderer.render();
        } else if (this.isTableRendering()) {
            this.tableRenderer.render();
        } else if (this.isListRendering()) {
            this.listRenderer.render();
        }

        this.addJSLinkEventListener();
        document.body.scrollTop = document.documentElement.scrollTop = 0;
    }

    async init() {
        // Init list
        if (this.listNeedsInit()) {
            await this.initList();
        }

        // Init ds and/or ds node
        if (this.dsNeedsInit()) {
            await this.initDS();
            this.initDSNode();
        } else if (this.dsNodeNeedsInit()) {
            this.initDSNode();
        }
    }

    listNeedsInit() {
        return (this.type === BROWSER_TYPES.LIST && !this.list);
    }

    async initList() {
        this.list = await this.util.parseToObject(this.dsOrList);
    }

    dsNeedsInit() {
        const searchParams = new URLSearchParams(window.location.search);
        const dsUID = searchParams.get('ds');
        return ((this.type === BROWSER_TYPES.LIST && dsUID && dsUID !== this.dsUID) ||
            (this.type === BROWSER_TYPES.DS && !this.ds));
    }

    async initDS() {
        if (this.type === BROWSER_TYPES.DS) {
            this.ds = await this.util.parseToObject(this.dsOrList);
        } else if (this.type === BROWSER_TYPES.LIST) {
            const searchParams = new URLSearchParams(window.location.search);
            this.dsUID = searchParams.get('ds');
            for (const part of this.list['schema:hasPart']) {
                const id = part['@id'];
                if (id.split('/').pop() === this.dsUID) {
                    this.ds = await this.util.parseToObject(id);
                    break;
                }
            }
        }

        this.sdoAdapter = new SDOAdapter();
        const vocabUrls = await this.getVocabUrlsForDS();
        await this.sdoAdapter.addVocabularies(vocabUrls);
    }

    /**
     * Extracts the URLs needed for the SDO-Adapter to handle the data of the given DS
     * @return {[String]} - The Array of URLs where the vocabularies can be fetched (for the SDO Adapter)
     */
    async getVocabUrlsForDS() {
        let vocabs = [];
        if (this.ds && this.ds['@graph'][0] && Array.isArray(this.ds['@graph'][0]['ds:usedVocabularies'])) {
            vocabs = this.ds['@graph'][0]['ds:usedVocabularies'];
        }
        if (this.ds && this.ds['@graph'][0] && this.ds['@graph'][0]['schema:schemaVersion']) {
            const sdoVersion = this.getSDOVersion();
            vocabs.push(await this.sdoAdapter.constructSDOVocabularyURL(sdoVersion));
        }
        return vocabs;
    }

    getSDOVersion() {
        let versionRegex = /.*schema\.org\/version\/([0-9\.]+)\//g;
        let match = versionRegex.exec(this.ds['@graph'][0]['schema:schemaVersion']);
        return match[1];
    }

    initDSNode() {
        const searchParams =  new URLSearchParams(window.location.search);
        this.path = searchParams.get('path');
        this.dsNode = this.dsHandler.getDSNodeForPath();
    }

    dsNodeNeedsInit() {
        const searchParams =  new URLSearchParams(window.location.search);
        const path = searchParams.get('path');
        return (path !== this.path);
    }

    isShaclRendering() {
        const searchParams = new URLSearchParams(window.location.search);
        const format = searchParams.get('format');
        return (format && format === 'shacl');
    }

    isNativeRendering() {
        const searchParams = new URLSearchParams(window.location.search);
        const ds = searchParams.get('ds');
        const mode = searchParams.get('mode');
        return (!mode &&
            ((this.type === BROWSER_TYPES.LIST && ds) ||
            (this.type === BROWSER_TYPES.DS)));
    }

    isTreeRendering() {
        const searchParams = new URLSearchParams(window.location.search);
        const ds = searchParams.get('ds');
        const treeMode = searchParams.get('mode') === 'tree';
        return (treeMode && (
            (this.type === BROWSER_TYPES.LIST && ds) ||
            (this.type === BROWSER_TYPES.DS)
        ));
    }

    isTableRendering() {
        const searchParams = new URLSearchParams(window.location.search);
        const ds = searchParams.get('ds');
        const tableMode = searchParams.get('mode') === 'table';
        return (tableMode && (
            (this.type === BROWSER_TYPES.LIST && ds) ||
            (this.type === BROWSER_TYPES.DS)
        ));
    }

    /**
     * Check if the list should be rendered.
     *
     * @returns {boolean} 'true' if the list should be rendered.
     */
    isListRendering() {
        const searchParams = new URLSearchParams(window.location.search);
        return (this.type === BROWSER_TYPES.LIST && !searchParams.get('voc'));
    }

    /**
     * Add an 'EventListener' to every JavaScript link in the HTML element.
     * Depending on the user action, the link will either open a new window or trigger the 'render' method.
     */
    addJSLinkEventListener() {
        const aJSLinks = this.elem.getElementsByClassName('a-js-link');

        for (const aJSLink of aJSLinks) { // forEach() not possible ootb for HTMLCollections
            aJSLink.addEventListener('click', async (event) => {
                if (event.ctrlKey) {
                    window.open(aJSLink.href);
                } else {
                    history.pushState(null, null, aJSLink.href);
                    await this.render();
                }
            });
        }
    }
}

module.exports = DSBrowser;
