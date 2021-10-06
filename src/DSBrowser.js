const SDOAdapter = require("schema-org-adapter");
const DsUtilities = require("ds-utilities");
const DSBrowserIFrameContent = require("./templates/DSBrowserIFrameContent.js");
const Util = require("./Util");
const DSHandler = require("./DSHandler");
const ListRenderer = require("./ListRenderer");
const DSRenderer = require("./DSRenderer");
const NativeRenderer = require("./NativeRenderer");
const TreeRenderer = require("./TreeRenderer");
const SHACLRenderer = require("./SHACLRenderer");
const NavigationBar = require("./components/NavigationBarRenderer.js");

class DSBrowser {
  constructor(params) {
    this.dsCache = {}; // cache for already fetched DS - if already opened DS is viewed, it has not to be fetched again
    this.sdoCache = []; // cache for already created SDO Adapter - if already used vocabulary combination is needed, it has not to be initialized again
    this.util = new Util(this);
    this.navigationBar = new NavigationBar(this);
    this.dsHandler = new DSHandler(this);
    this.listRenderer = new ListRenderer(this);
    this.dsRenderer = new DSRenderer(this);
    this.nativeRenderer = new NativeRenderer(this);
    this.treeRenderer = new TreeRenderer(this);
    this.shaclRenderer = new SHACLRenderer(this);

    this.editFunction = params.editFunction;
    this.targetElement = params.targetElement;
    this.locationControl = params.locationControl !== false;
    this.selfFileHost = params.selfFileHost === true; // if this is true, the list and ds files are being fetched from the same host where the ds browser is being served (e.g. to make localhost/staging work). Makes only sense if locationControl = true
    if (this.locationControl) {
      // if locationControl is true -> read parameters from URL - the ds browser is assumed to be at the domain level of a url (not inside a path /something/ ) and have complete control over the routes /ds/* and /list/*
      this.readStateFromUrl();
    } else {
      // if locationControl is false -> read parameters from initialization, at least dsId or listId must be given!
      this.listId = params.listId || null;
      this.dsId = params.dsId || null;
      this.path = params.path || null;
      this.viewMode = params.viewMode || null;
      this.format = params.format || null;
    }

    if (this.locationControl) {
      window.addEventListener("popstate", async () => {
        this.readStateFromUrl();
        await this.render();
      });
    }
    this.initIFrame();
    console.log(this); // todo delete debug
  }

  async initIFrame() {
    this.targetElement.innerHTML = this.frame();
    this.dsbFrame = document.getElementById("ds-browser-iframe");
    this.dsbContext = this.dsbFrame.contentWindow.document;
    this.dsbContext.open();
    this.dsbContext.write(DSBrowserIFrameContent);
    this.dsbContext.close();
    // give the browser some time to render the iFrame
    setTimeout(
      function () {
        this.dsbContainer = this.dsbContext.getElementById(
          "ds-browser-main-container"
        );
        this.render();
      }.bind(this),
      250
    );
  }

  // returns the html frame for this element, which is required to be rendered in a later point of the process
  frame() {
    return `<div><iframe id="ds-browser-iframe" width="100%" frameborder="0" scrolling="no" style="min-height: 99vh;"></iframe></div>`;
  }

  fixFrameSize() {
    const frameBody = this.dsbContext.body;
    this.dsbFrame.style.height = frameBody.scrollHeight + "px";
    console.log("size adaption");
  }

  async render() {
    this.dsbContainer.innerHTML = this.util.createHtmlLoading();
    this.fixFrameSize();
    await this.renderInit();
    if (this.format === "shacl") {
      // render raw SHACL of DS
      this.shaclRenderer.render();
    } else if (
      this.dsId &&
      this.viewMode !== "tree" &&
      this.viewMode !== "table"
    ) {
      // render DS with native view
      this.nativeRenderer.render();
    } else if (this.dsId && this.viewMode === "tree") {
      // render DS with tree view
      this.treeRenderer.render();
      this.fixFrameSize();
    } else if (this.listId) {
      // render List as table
      this.listRenderer.render();
      this.fixFrameSize();
    } else {
      throw new Error("Input parameters invalid.");
    }
    this.addJSLinkEventListener();
    document.body.scrollTop = document.documentElement.scrollTop = 0;
  }

  async renderInit() {
    // Init List
    if (
      this.listId &&
      (!this.list || !this.list["@id"].endsWith(this.listId))
    ) {
      await this.initList();
    }
    // Init DS
    if (
      this.dsId &&
      (!this.ds || !this.util.getDSRootNode(this.ds)["@id"].endsWith(this.dsId))
    ) {
      await this.initDS();
      // Init DS Node
    }
    if (this.ds) {
      this.dsRootNode = this.util.getDSRootNode(this.ds);
      this.dsNode = this.dsHandler.getDSNodeForPath();
    }
  }

  async initList() {
    this.list = await this.util.parseToObject(
      this.util.getFileHost() + "/list/" + this.listId + "?representation=lean"
    );
  }

  async initDS() {
    if (this.dsCache[this.dsId]) {
      this.ds = this.dsCache[this.dsId];
    } else {
      let ds = await this.util.parseToObject(
        this.util.getFileHost() + "/ds/" + this.dsId + "?populate=true"
      );
      if (
        ds &&
        ds["@graph"] &&
        ds["@graph"][0] &&
        !ds["@graph"][0]["ds:version"]
      ) {
        ds = await this.util.parseToObject(
          this.util.getFileHost() +
            "/api/v2/domainspecifications/dsv7/" +
            this.dsId +
            "?populate=true"
        );
      }
      this.dsCache[this.dsId] = ds;
      this.ds = ds;
    }
    if (!this.sdoAdapter) {
      // create an empty sdo adapter at the start in order to create vocabulary URLs
      this.sdoAdapter = new SDOAdapter({ schemaHttps: true });
    }
    const neededVocabUrls = await this.getVocabUrlsForDS();
    let sdoAdapterNeeded = this.util.getSdoAdapterFromCache(neededVocabUrls);
    if (!sdoAdapterNeeded) {
      sdoAdapterNeeded = new SDOAdapter({
        schemaHttps: true,
        equateVocabularyProtocols: true,
      });
      await sdoAdapterNeeded.addVocabularies(neededVocabUrls);
      this.sdoCache.push({
        vocabUrls: neededVocabUrls,
        sdoAdapter: sdoAdapterNeeded,
      });
    }
    this.dsUtil = DsUtilities.getDsUtilitiesForDs(this.ds);
    this.sdoAdapter = sdoAdapterNeeded;
  }

  /**
   * Extracts the URLs needed for the SDO-Adapter to handle the data of the given DS
   * @return {[String]} - The Array of URLs where the vocabularies can be fetched (for the SDO Adapter)
   */
  async getVocabUrlsForDS() {
    if (!this.ds) {
      return [];
    }
    let vocabs = [];
    const dsRootNode = this.util.getDSRootNode(this.ds);
    if (dsRootNode && Array.isArray(dsRootNode["ds:usedVocabulary"])) {
      vocabs = this.util.hardCopyJson(dsRootNode["ds:usedVocabulary"]);
    }
    if (dsRootNode && dsRootNode["schema:schemaVersion"]) {
      const sdoVersion = this.getSDOVersion(dsRootNode["schema:schemaVersion"]);
      vocabs.push(await this.sdoAdapter.constructSDOVocabularyURL(sdoVersion));
    }
    return vocabs;
  }

  getSDOVersion(schemaVersionValue) {
    if (schemaVersionValue.startsWith("http")) {
      let versionRegex = /.*schema\.org\/version\/([0-9.]+)\//g;
      let match = versionRegex.exec(schemaVersionValue);
      if (match && match[1]) {
        return match[1];
      }
    }
    return schemaVersionValue;
  }

  /**
   * Add an 'EventListener' to every JavaScript link in the HTML element.
   * Depending on the user action, the link will either open a new window or trigger the 'render' method.
   */
  addJSLinkEventListener() {
    const aJSLinks = this.targetElement.getElementsByClassName("a-js-link");
    for (const aJSLink of aJSLinks) {
      // forEach() not possible ootb for HTMLCollections
      aJSLink.addEventListener("click", async (event) => {
        if (this.locationControl) {
          if (event.ctrlKey) {
            window.open(aJSLink.href); // disabled in non control location
          } else {
            history.pushState(null, null, aJSLink.href); // disabled in non control location
            this.navigate(
              JSON.parse(
                decodeURIComponent(aJSLink.getAttribute("data-state-changes"))
              )
            );
            // await this.render();
          }
        } else {
          this.navigate(
            JSON.parse(
              decodeURIComponent(aJSLink.getAttribute("data-state-changes"))
            )
          );
        }
      });
    }
  }

  readStateFromUrl() {
    const searchParams = new URLSearchParams(window.location.search);
    this.path = searchParams.get("path") || null;
    // fix for MTE path in url -> " + " is written as "%20+%20" which is not correctly returned by the URLSearchParams class
    if (this.path && this.path.includes("   ")) {
      this.path = this.path.replace(new RegExp(" {3}", "g"), " + ");
    }
    this.format = searchParams.get("format") || null;
    this.viewMode = searchParams.get("mode") || null;
    if (window.location.pathname.includes("/ds/")) {
      this.listId = null;
      let dsId = window.location.pathname.substring("/ds/".length);
      if (this.dsId !== dsId) {
        this.dsId = dsId;
        this.ds = null;
      }
    } else if (window.location.pathname.includes("/list/")) {
      let listId = window.location.pathname.substring("/list/".length);
      if (this.listId !== listId) {
        this.listId = listId;
        this.list = null;
      }
      let dsId = searchParams.get("ds") || null;
      if (this.dsId !== dsId) {
        this.dsId = dsId;
        this.ds = null;
      }
    } else {
      this.listId = null;
      this.list = null;
      this.dsId = null;
      this.ds = null;
    }
  }

  navigate(newState) {
    if (newState.listId !== undefined) {
      this.listId = newState.listId;
    }
    if (newState.dsId !== undefined) {
      this.dsId = newState.dsId;
    }
    if (newState.path !== undefined) {
      this.path = newState.path;
    }
    if (newState.viewMode !== undefined) {
      this.viewMode = newState.viewMode;
    }
    if (newState.format !== undefined) {
      this.format = newState.format;
    }
    // If there is no listId, there shall be no list
    if (this.listId === null) {
      this.list = undefined;
    }
    // If there is no dsId, there shall be no ds
    if (this.dsId === null) {
      this.ds = undefined;
    }
    // If there is no ds, there shall be no path
    if (!this.ds) {
      this.path = null;
    }
    this.render();
  }
}

module.exports = DSBrowser;
