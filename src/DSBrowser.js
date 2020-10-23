const BROWSER_TYPES = {
    DS: 'DS',
    LIST: 'LIST'
};

class DSBrowser {
    constructor(elem, dsOrList, type = BROWSER_TYPES.DS) {
        this.elem = elem;
        this.dsOrList = dsOrList;
        this.type = type;

        window.addEventListener('popstate', () => {
            this.render();
        });
    }

    render() {
        this.elem.innerHTML =
            '<img src="https://raw.githubusercontent.com/YarnSeemannsgarn/ds-browser/main/images/loading.gif" '
            + 'alt="Loading Animation" style="margin-top: 6px">';
    }
}