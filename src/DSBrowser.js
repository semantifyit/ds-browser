import Util from './Util';

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

        window.addEventListener('popstate', async () => {
            await this.render();
        });
    }

    async render() {
        this.elem.innerHTML =
            '<img src="https://raw.githubusercontent.com/YarnSeemannsgarn/ds-browser/main/images/loading.gif" '
            + 'alt="Loading Animation" style="margin-top: 6px">';

        await this.init();
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
            this.ds = await this.util.parseToObject(this.vocabOrList);
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
    }
}