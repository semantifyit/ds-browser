import SDOAdapter from 'schema-org-adapter';

import Util from './Util';
import DSHandler from './DSHandler';
import DSRenderer from './DSRenderer';

const BROWSER_TYPES = {
    DS: 'DS',
    LIST: 'LIST'
};

class DSBrowser {
    constructor(elem, dsOrList, type = BROWSER_TYPES.DS) {
        this.elem = elem;
        this.dsOrList = dsOrList;
        this.type = type;

        this.util = new Util(this);
        this.dsHandler = new DSHandler(this);
        this.dsRenderer = new DSRenderer(this);

        window.addEventListener('popstate', async () => {
            await this.render();
        });
    }

    async render() {
        this.elem.innerHTML =
            '<img src="https://raw.githubusercontent.com/YarnSeemannsgarn/ds-browser/main/images/loading.gif" '
            + 'alt="Loading Animation" style="margin-top: 6px">';

        await this.init();

        if (this.isDSRendering()) {
            this.dsRenderer.render();
        }

        this.addJSLinkEventListener();
        document.body.scrollTop = document.documentElement.scrollTop = 0;
    }

    async init() {
        // Init list
        if (this.listNeedsInit()) {
            await this.initList();
        }

        // Init vocab
        if (this.dsNeedsInit()) {
            await this.initDS();
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
                    this.dsName = part['schema:name'];
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

    isDSRendering() {
        const searchParams = new URLSearchParams(window.location.search);
        return ((this.type === BROWSER_TYPES.LIST && searchParams.get('ds')) ||
            (this.type === BROWSER_TYPES.DS));
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
