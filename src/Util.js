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
        if (htmlCode.indexOf('href="https://schema.org') === -1 && htmlCode.indexOf('href="http://schema.org') === -1) {
            // No sdo
            htmlCode = htmlCode.replace(/<a /g, '<a class="outgoingLink" ');
        } else {
            htmlCode = htmlCode.replace(/<a /g, '<a class="outgoingLinkRed" ');
        }
        htmlCode = htmlCode.replace(/<a /g, '<a target="_blank" ');
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
}

module.exports = Util;
