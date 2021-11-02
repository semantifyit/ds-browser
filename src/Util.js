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
    // absolute links for schema.org - e.g. https://schema.org/gtin13
    result = result.replace(/https?:\/\/schema.org\/([^,.\s]*)/g, (match) => {
      const style = this.createExternalLinkStyle(match);
      return `<a href="${match}" style="${style}" target="_blank">${match}</a>`;
    });
    // html links (including relative links of schema.org) - e.g. <a class="xyz" href="/Text"> ...
    result = result.replace(
      /<a(.*?)href="(.*?)"/g,
      (match, otherLinkAttributes, url) => {
        if (url.startsWith("/")) {
          url = "http://schema.org" + url;
        }
        const style = this.createExternalLinkStyle(url);
        return `<a ${otherLinkAttributes} href="${url}" style="${style}" target="_blank"`;
      }
    );
    // markdown for relative links of schema.org without label - e.g. [[ImageObject]]
    result = result.replace(/\[\[(.*?)]]/g, (match, term) => {
      const url = "http://schema.org/" + term;
      const style = this.createExternalLinkStyle(url);
      return `<a href="${url}" style="${style}" target="_blank">${term}</a>`;
    });
    // markdown for links (including relative schema.org) with label - e.g. [background notes](/docs/datamodel.html#identifierBg) or [WGS 84](https://en.wikipedia.org/wiki/World_Geodetic_System)
    result = result.replace(/\[(.*?)]\((.*?)\)/g, (match, label, url) => {
      if (url.startsWith("/")) {
        url = "http://schema.org/" + url;
      }
      const style = this.createExternalLinkStyle(url);
      return `<a href="${url}" style="${style}" target="_blank">${label}</a>`;
    });
    // new line
    result = result.replace(/\\n/g, () => {
      return "</br>";
    });
    // markdown for bold
    result = result.replace(/__(.*?)__/g, (match, text) => {
      return `<b>${text}</b>`;
    });
    // markdown for code
    result = result.replace(/```(.*?)```/g, (match, code) => {
      return `<code>${code}</code>`;
    });
    return result;
  }

  // returns following attributes for internal links: href, onclick, data-state-changes
  // internal links MUST have the class a-js-link
  createInternalLinkAttributes(navigationChanges) {
    const hrefLink = this.browser.locationControl
      ? this.createInternalHref(navigationChanges)
      : "javascript:void(0)";
    const htmlOnClick = this.browser.locationControl
      ? 'onclick="return false;"'
      : "";
    const htmlState = encodeURIComponent(JSON.stringify(navigationChanges));
    return `href="${hrefLink}" ${htmlOnClick} data-state-changes="${htmlState}"`;
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

  // creates an object with the navigation "coordinates" constructed from the actual navigation position and a given object containing navigation changes
  createNavigationState(navigationChanges) {
    const parameters = ["listId", "dsId", "path", "viewMode", "format"];
    let newState = {};
    for (const p of parameters) {
      if (navigationChanges[p] !== undefined) {
        newState[p] = navigationChanges[p];
      } else {
        newState[p] = this.browser[p];
      }
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
    return `<div class="d-flex align-items-center justify-content-center" style="height: 100%;">
              <div class="spinner-border text-primary" style="width: 4rem; height: 4rem;" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
            </div>`;
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

  // creates a clone of the given JSON input (without reference to the original input)
  cloneJson(input) {
    if (input === undefined) {
      return undefined;
    }
    return JSON.parse(JSON.stringify(input));
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
