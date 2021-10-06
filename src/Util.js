class Util {
  constructor(browser) {
    this.browser = browser;
  }

  async parseToObject(variable) {
    if (this.isString(variable)) {
      /**
       * @type string
       */
      let jsonString;
      if (this.isValidUrl(variable)) {
        jsonString = await this.getJson(variable);
      } else {
        jsonString = variable;
      }
      return JSON.parse(jsonString);
    } else {
      return variable;
    }
  }

  isString(variable) {
    return typeof variable === "string" || variable instanceof String;
  }

  isValidUrl(string) {
    try {
      new URL(string);
    } catch (e) {
      return false;
    }
    return true;
  }

  getJson(url) {
    return new Promise(function (resolve, reject) {
      let xhr = new XMLHttpRequest();
      xhr.open("GET", url);
      xhr.setRequestHeader("Accept", "application/json");
      xhr.onload = function () {
        if (this.status >= 200 && this.status < 300) {
          resolve(xhr.response);
        } else {
          reject({
            status: this.status,
            statusText: xhr.statusText,
          });
        }
      };
      xhr.onerror = function () {
        reject({
          status: this.status,
          statusText: xhr.statusText,
        });
      };
      xhr.send();
    });
  }

  /**
   * Replace 'schema:' and escapes characters in iri.
   *
   * @param {string} iri - The IRI that should pretty-printed.
   * @returns {string} The pretty-printed IRI.
   */
  prettyPrintIri(iri) {
    return iri.replace(/^(schema:|https?:\/\/schema.org\/)(.+)/, "$2");
  }

  repairLinksInHTMLCode(htmlCode) {
    let result = htmlCode;
    // relative links of schema.org
    result = result.replace(/<a(.*?)href="(.*?)"/g, (match, group1, group2) => {
      if (group2.startsWith("/")) {
        group2 = "http://schema.org" + group2;
      }
      const style = this.createExternalLinkStyle(group2);
      return (
        "<a" +
        group1 +
        'href="' +
        group2 +
        '" style="' +
        style +
        '" target="_blank"'
      );
    });
    // markdown for relative links of schema.org
    result = result.replace(/\[\[(.*?)]]/g, (match, group1) => {
      const URL = "http://schema.org/" + group1;
      const style = this.createExternalLinkStyle(URL);
      return (
        '<a href="' +
        URL +
        '" style="' +
        style +
        '" target="_blank">' +
        group1 +
        "</a>"
      );
    });
    // markdown for outgoing link
    result = result.replace(/\[(.*?)]\((.*?)\)/g, (match, group1, group2) => {
      const style = this.createExternalLinkStyle(group2);
      return (
        '<a href="' +
        group2 +
        '" style="' +
        style +
        '" target="_blank">' +
        group1 +
        "</a>"
      );
    });
    // new line
    result = result.replace(/\\n/g, () => {
      return "</br>";
    });
    // bold
    result = result.replace(/__(.*?)__/g, (match, group1) => {
      return "<b>" + group1 + "</b>";
    });
    // code
    result = result.replace(/```(.*?)```/g, (match, group1) => {
      return "<code>" + group1 + "</code>";
    });
    return result;
  }

  createInternalLink(navigationChanges, text) {
    text = this.escHtml(text);
    const hrefLink = this.browser.locationControl
      ? this.createInternalHref(navigationChanges)
      : "javascript:void(0)";
    const htmlOnClick = this.browser.locationControl
      ? 'onclick="return false;"'
      : "";
    const htmlState =
      'data-state-changes="' +
      encodeURIComponent(JSON.stringify(navigationChanges)) +
      '"';
    return `<a class="a-js-link" href="${hrefLink}" ${htmlOnClick} ${htmlState}>
        ${text}</a>`;
  }

  createInternalHref(navigationChanges, htmlEscaped = true) {
    let navigationState = this.createNavigationState(navigationChanges);
    let domain =
      window.location.protocol +
      "//" +
      (window.location.host ? window.location.host : "");
    let url;
    let urlParameterArray = [];
    if (navigationState.listId) {
      // is list
      url = domain + "/list/" + navigationState.listId;
      if (navigationState.dsId) {
        urlParameterArray.push(["ds", navigationState.dsId]);
      }
    } else {
      // must be ds
      url = domain + "/ds/" + navigationState.dsId;
    }
    if (navigationState.path) {
      urlParameterArray.push(["path", navigationState.path]);
    }
    if (navigationState.viewMode) {
      urlParameterArray.push(["mode", navigationState.viewMode]);
    }
    if (navigationState.format) {
      urlParameterArray.push(["format", navigationState.format]);
    }
    for (let i = 0; i < urlParameterArray.length; i++) {
      let prefix = "&";
      if (i === 0) {
        prefix = "?";
      }
      url += prefix + urlParameterArray[i][0] + "=" + urlParameterArray[i][1];
    }
    return htmlEscaped ? this.escHtml(url) : url;
  }

  createNavigationState(navigationChanges) {
    let newState = {};
    if (navigationChanges.listId !== undefined) {
      newState.listId = navigationChanges.listId;
    } else {
      newState.listId = this.browser.listId;
    }
    if (navigationChanges.dsId !== undefined) {
      newState.dsId = navigationChanges.dsId;
    } else {
      newState.dsId = this.browser.dsId;
    }
    if (navigationChanges.path !== undefined) {
      newState.path = navigationChanges.path;
    } else {
      newState.path = this.browser.path;
    }
    if (navigationChanges.viewMode !== undefined) {
      newState.viewMode = navigationChanges.viewMode;
    } else {
      newState.viewMode = this.browser.viewMode;
    }
    if (navigationChanges.format !== undefined) {
      newState.format = navigationChanges.format;
    } else {
      newState.format = this.browser.format;
    }
    return newState;
  }

  /**
   * Escape HTML characters.
   *
   * @param {string} chars - The characters that should be escaped.
   * @returns {string} The escaped characters.
   */
  escHtml(chars) {
    return chars
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Create HTML attributes for elements.
   *
   * @param {object|null} attr - The attributes as key-value pairs.
   * @returns {string} The resulting HTML.
   */
  createHtmlAttr(attr) {
    if (attr) {
      return Object.entries(attr)
        .map((a) => {
          return " " + this.escHtml(a[0]) + '="' + this.escHtml(a[1]) + '"';
        })
        .join("");
    } else {
      return "";
    }
  }

  /**
   * Create a HTML link to an external IRI.
   *
   * @param {string} href - The href value of the link.
   * @param {string|null} text - The text of the link.
   * @param {object|null} attr - The HTML attributes as key-value pairs.
   * @returns {string} The resulting HTML.
   */
  createLink(href, text = null, attr = null) {
    const urlObj = new URL(href);
    if (
      window.location.hostname !== urlObj.hostname ||
      href.includes("/voc/")
    ) {
      let additionalStyles = " " + this.createExternalLinkStyle(href);

      if (!attr) {
        attr = { style: additionalStyles };
        // eslint-disable-next-line no-prototype-builtins
      } else if (!attr.hasOwnProperty("style")) {
        attr["style"] = additionalStyles;
      } else {
        attr["style"] = attr["style"] + additionalStyles;
      }
      attr["target"] = "_blank";
    }

    return (
      '<a href="' +
      this.escHtml(href) +
      '"' +
      this.createHtmlAttr(attr) +
      ">" +
      (text ? this.prettyPrintIri(text) : this.prettyPrintIri(href)) +
      "</a>"
    );
  }

  /**
   * Create HTML attribute 'style' for an external link.
   *
   * @param iri - The IRI of the external link.
   * @return {string} The resulting style attribute.
   */
  createExternalLinkStyle(iri) {
    let style = `background-position: center right; 
            background-repeat: no-repeat;
            background-size: 10px 10px; 
            padding-right: 13px; `;
    if (/^https?:\/\/schema.org/.test(iri)) {
      style +=
        "background-image: url(https://raw.githubusercontent.com/semantifyit/ds-browser/main/images/external-link-icon-red.png);";
    } else {
      style +=
        "background-image: url(https://raw.githubusercontent.com/semantifyit/ds-browser/main/images/external-link-icon-blue.png);";
    }
    return style;
  }

  createHtmlLoading() {
    return `<div class="text-center" style="margin-top: 100px;"><div class="spinner-border text-danger" style="width: 4rem; height: 4rem;" role="status">
              <span class="visually-hidden">Loading...</span>
            </div></div>`;
  }

  /**
   * Create a HTML table row with RDFa (https://en.wikipedia.org/wiki/RDFa) attributes.
   *
   * @param {string} rdfaTypeOf - The RDFa type of the table row.
   * @param {string} rdfaResource - The RDFa resource.
   * @param {string} mainColRdfaProp - The RDFa property of the main column.
   * @param {string} mainColLink - The link of the main column.
   * @param {string} sideCols - The HTML of the side columns.
   * @param {string|null} mainColClass - The CSS class of the main column.
   * @returns {string} The resulting HTML.
   */
  createHtmlTableRow(
    rdfaTypeOf,
    rdfaResource,
    mainColRdfaProp,
    mainColLink,
    sideCols,
    mainColClass = null
  ) {
    const trContent =
      this.createMainCol(mainColRdfaProp, mainColLink, mainColClass) + sideCols;
    return `<tr typeof="${rdfaTypeOf}" resource="${rdfaResource}">
            ${trContent}
            </tr>`;
  }

  /**
   * Create a HTML main column for a table row with RDFa (https://en.wikipedia.org/wiki/RDFa) attributes.
   *
   * @param {string} rdfaProp - The RDFa property of the column.
   * @param {string} link - The link of the column.
   * @param {string|null} className -  The CSS class of the column.
   * @returns {string} The resulting HTML.
   */
  createMainCol(rdfaProp, link, className = null) {
    return (
      "" +
      "<th" +
      (className ? ' class="' + className + '"' : "") +
      ' scope="row">' +
      this.createCodeLink(link, { property: rdfaProp }) +
      "</th>"
    );
  }

  /**
   * Create a HTML code element with a link inside it.
   *
   * @param {string} link - The link.
   * @param {object|null} codeAttr - The HTML attributes of the code element.
   * @returns {string} The resulting HTML.
   */
  createCodeLink(link, codeAttr = null) {
    return (
      "" + "<code" + this.createHtmlAttr(codeAttr) + ">" + link + "</code>"
    );
  }

  /**
   * Create a HTML table with class 'definition-table' and 'table'.
   *
   * @param {string|string[]} ths - The table header cell/s. Must include <th> tags.
   * @param {string|string[]} trs - The table body row/s. Can already include <tr> tags to be more flexible.
   * @param {object|null} tableAttr - The HTML attributes of the table.
   * @param {object|null} tbodyAttr - The HTML attributes of the table body.
   * @returns {string} The resulting HTML.
   */
  createHtmlDefinitionTable(ths, trs, tableAttr = null, tbodyAttr = null) {
    if (!Array.isArray(ths)) {
      ths = [ths];
    }
    if (!Array.isArray(trs)) {
      trs = [trs];
    }
    const htmlTableAttr = this.createHtmlAttr(tableAttr);
    const htmlTbodyAttr = this.createHtmlAttr(tbodyAttr);
    const htmlTheadContent = ths
      .map((th) => {
        return "<th>" + th + "</th>";
      })
      .join("");
    const htmlTbodyContent = trs[0].startsWith("<tr")
      ? trs.join("")
      : trs
          .map((tr) => {
            return "<tr>" + tr + "</tr>";
          })
          .join("");
    return `<table class="definition-table table" ${htmlTableAttr}>
            <thead><tr>${htmlTheadContent}</tr></thead>
            <tbody ${htmlTbodyAttr}>
            ${htmlTbodyContent}
            </tbody></table>`;
  }

  /**
   * Create a HTML div with the main content for the vocab browser element.
   *
   * @param {string} rdfaTypeOf - The RDFa type of the main content.
   * @param {string} mainContent - The HTML of the main content.
   * @returns {string} The resulting HTML.
   */
  createHtmlMainContent(rdfaTypeOf, mainContent) {
    return `
            <div>
                <div id="mainContent" vocab="http://schema.org/" typeof="${rdfaTypeOf}" resource="${window.location}">
                    ${mainContent}
                </div>
            </div>`;
  }

  createHtmlExternalLinkLegend() {
    const commonExtLinkStyle = "margin-right: 3px; ";
    const extLinkStyleBlue =
      commonExtLinkStyle + this.createExternalLinkStyle("");
    const extLinkStyleRed =
      commonExtLinkStyle +
      this.createExternalLinkStyle("http://schema.org") +
      " margin-left: 6px;";

    return (
      '<p style="font-size: 12px; margin-top: 0">' +
      '(<span style="' +
      extLinkStyleBlue +
      '"></span>External link' +
      '<span style="' +
      extLinkStyleRed +
      '"></span>External link to schema.org )' +
      "</p>"
    );
  }

  createTermLink(term) {
    const termObj = this.browser.sdoAdapter.getTerm(term);
    const vocabURLs = termObj.getVocabURLs();
    let href;
    if (vocabURLs) {
      for (const vocabURL of vocabURLs) {
        if (/http(s)?:\/\/.*?\/voc\//.test(vocabURL)) {
          href = vocabURL + "?term=" + term;
          break;
        }
      }
    }
    href = href ? href : termObj.getIRI();
    return this.createLink(href, termObj.getIRI(true));
  }

  prettyPrintClassDefinition(classDef) {
    // ClassDefinition can be a string, or an array of strings (MTE)
    // ClassDefinition include strings with the vocab indicator in them
    // Remove vocab if it is the standard schema:
    // Return a human readable string of the classDefinition
    if (Array.isArray(classDef)) {
      return classDef
        .map((classDefPart) => {
          return this.prettyPrintIri(classDefPart);
        })
        .join(", ");
    } else {
      return this.prettyPrintIri(classDef);
    }
  }

  fade(element) {
    let op = 0.05; // initial opacity
    const timer = setInterval(() => {
      if (op >= 1) {
        clearInterval(timer);
      }
      element.style.opacity = op;
      element.style.filter = "alpha(opacity=" + op * 100 + ")";
      op += op * 0.05;
    }, 10);
  }

  getSdoAdapterFromCache(vocabUrls) {
    for (const sdoAdapterCacheEntry of this.browser.sdoCache) {
      let match = true;
      for (const voc1 of vocabUrls) {
        if (!sdoAdapterCacheEntry.vocabUrls.includes(voc1)) {
          match = false;
          break;
        }
      }
      for (const voc2 of sdoAdapterCacheEntry.vocabUrls) {
        if (!vocabUrls.includes(voc2)) {
          match = false;
          break;
        }
      }
      if (match) {
        return sdoAdapterCacheEntry.sdoAdapter;
      }
    }
    return null;
  }

  // Creates a hard copy of a given JSON. undefined wont be copied
  hardCopyJson(jsonInput) {
    return JSON.parse(JSON.stringify(jsonInput));
  }

  getFileHost() {
    if (this.browser.selfFileHost) {
      return window.location.origin;
    } else {
      return "https://semantify.it";
    }
  }

  // Returns a string for a meta-data value. This value is expected to have different language-tagged strings. If not, it is expected to be a string, which is returned.
  getLanguageString(value, preferableLanguage = "en") {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return null;
      }
      let match = value.find((el) => el["@language"] === preferableLanguage);
      if (!match) {
        match = value[0]; // Take value at first position
      }
      return match["@value"];
    }
    return value;
  }

  // Returns the root node of a given DS, returns null if it couldn't be found
  getDSRootNode(ds) {
    if (ds && Array.isArray(ds["@graph"])) {
      const rootNode = ds["@graph"].find(
        (el) => el["@type"] === "ds:DomainSpecification"
      );
      if (rootNode) {
        return rootNode;
      }
    }
    return null;
  }

  // Returns the referenced node shape
  getReferencedNode(id) {
    if (this.browser.ds && Array.isArray(this.browser.ds["@graph"])) {
      return this.browser.ds["@graph"].find((el) => el["@id"] === id) || null;
    }
    return null;
  }

  // Returns the node shape of the actual range, if the range has a node shape
  getClassNodeIfExists(rangeNode) {
    if (
      rangeNode["sh:node"] &&
      rangeNode["sh:node"]["@id"] &&
      Object.keys(rangeNode["sh:node"]).length === 1
    ) {
      // is referenced node
      return this.getReferencedNode(rangeNode["sh:node"]["@id"]);
    } else if (rangeNode["sh:node"] && rangeNode["sh:node"]["sh:class"]) {
      // is not referenced node
      return rangeNode["sh:node"];
    }
    return undefined;
  }
}

module.exports = Util;
