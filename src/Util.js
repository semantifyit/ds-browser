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
        return (typeof variable === 'string' || variable instanceof String);
    }

    isValidUrl(string) {
        try {
            new URL(string);
        } catch (_) {
            return false;
        }
        return true;
    }

    getJson(url) {
        return new Promise(function (resolve, reject) {
            let xhr = new XMLHttpRequest();
            xhr.open('GET', url);
            xhr.setRequestHeader('Accept', 'application/json');
            xhr.onload = function () {
                if (this.status >= 200 && this.status < 300) {
                    resolve(xhr.response);
                } else {
                    reject({
                        status: this.status,
                        statusText: xhr.statusText
                    });
                }
            };
            xhr.onerror = function () {
                reject({
                    status: this.status,
                    statusText: xhr.statusText
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
        const schema = 'schema:';
        if (iri.startsWith(schema)) {
            return iri.substring(schema.length);
        }
        return this.escHtml(iri);
    }

    makeURLFromIRI(IRITerm) {
        const vocabularies = this.browser.sdoAdapter.getVocabularies();
        const vocabKeys = Object.keys(vocabularies);
        vocabKeys.forEach((vocabKey) => {
            if (IRITerm.startsWith(vocabKey)) {
                return vocabularies[vocabKey] + IRITerm.substring(IRITerm.indexOf(':') + 1);
            }
        });

        return '';
    }

    repairLinksInHTMLCode(htmlCode) {
        htmlCode = htmlCode.replace(/ href="\//g, ' href="https://schema.org/');
        let style = '' +
            'background-position: center right; ' +
            'background-repeat: no-repeat; ' +
            'background-size: 10px 10px; ' +
            'padding-right: 13px; ';
        if (htmlCode.indexOf('href="https://schema.org') === -1 && htmlCode.indexOf('href="http://schema.org') === -1) {
            // No sdo
            style += 'background-image: url(https://raw.githubusercontent.com/YarnSeemannsgarn/ds-browser/main/images/external-link-icon-blue.png);';
        } else {
            style += 'background-image: url(https://raw.githubusercontent.com/YarnSeemannsgarn/ds-browser/main/images/external-link-icon-red.png);';
        }
        htmlCode = htmlCode.replace(/<a /g, '<a target="_blank" style="' + style  +'" ');
        return htmlCode;
    }

    // Get the corresponding SDO datatype from a given SHACL XSD datatype
    dataTypeMapperFromSHACL(dataType) {
        switch (dataType) {
            case 'xsd:string':
                return 'Text';
            case 'xsd:boolean' :
                return 'Boolean';
            case 'xsd:date' :
                return 'Date';
            case 'xsd:dateTime':
                return 'DateTime';
            case 'xsd:time':
                return 'Time';
            case 'xsd:double':
                return 'Number';
            case 'xsd:float':
                return 'Float';
            case  'xsd:integer':
                return 'Integer';
            case 'xsd:anyURI':
                return 'URL';
        }
        return null; // If no match
    }

    // Converts a range array/string into a string usable in functions
    rangesToString(ranges) {
        if (Array.isArray(ranges)) {
            return ranges.map((range) => {
                return this.prettyPrintIri(range);
            }).join(' + ');
        } else {
            return this.prettyPrintIri(ranges); // Is already string
        }
    }

    /**
     * Create an IRI with the current browser IRI and the given query parameter.
     * The query parameter can be either set, overwritten, deleted or enhanced.
     *
     * @param {string} key - The query parameter key.
     * @param {string} val - The query parameter values.
     * @param {string} enhanceSymbol - TODO
     * @returns {string} The resulting IRI.
     */
    createIriWithQueryParam(key, val, enhanceSymbol=null) {
        const searchParams = new URLSearchParams(window.location.search);
        if (val && val !== '') {
            const prevVal = searchParams.get(key);
            if (prevVal !== null && enhanceSymbol) {
                searchParams.set(key, prevVal + enhanceSymbol + val);
            } else {
                searchParams.set(key, val);
            }
        } else {
            searchParams.delete(key);
        }
        const queryString = searchParams.toString();
        const origin = window.location.protocol + '//' + (window.location.host ? window.location.host : '');
        return origin + window.location.pathname + (queryString !== '' ? '?' + queryString : '');
    }

    /**
     * Create a HTML JavaScript link that imitates a standard link with the current browser IRI and the given query
     * parameter.
     *
     * @param {string} queryKey - The query parameter key.
     * @param {string|null} queryVal - The query parameter value.
     * @param {string|null} enhanceSymbol - TODO
     * @param {string|null} text - The text of the link.
     * @param {object|null} attr - The HTML attributes of the link.
     * @returns {string} The resulting HTML.
     */
    createJSLink(queryKey, queryVal, enhanceSymbol = null, text = null, attr = null) {
        const iri = this.createIriWithQueryParam(queryKey, queryVal, enhanceSymbol);
        return '' +
            '<a ' +
            'class="a-js-link" ' +
            'href="' + this.escHtml(iri) + '" ' +
            'onclick="return false;"' +
            this.createHtmlAttr(attr) + '>' +
            (text ? this.escHtml(text) : this.escHtml(queryVal)) +
            '</a>';
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
            return Object.entries(attr).map((a) => {
                return ' ' + this.escHtml(a[0]) + '="' + this.escHtml(a[1]) + '"';
            }).join('');
        } else {
            return '';
        }
    }
}

module.exports = Util;
