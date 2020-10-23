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
}

module.exports = Util;
