# Domain Specification Browser

## Installation

### Installation via CDN

Add the CSS and the bundled CDN file to your website:

``` html
<link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/gh/semantifyit/ds-browser@76f4c55/ds-browser.css" />
<script src="https://cdn.jsdelivr.net/gh/semantifyit/ds-browser@76f4c55/dist/ds-browser.min.js">
```

## Usage

Import your Domain Specification and render the corresponding HTML:

``` html
<div id="ds"></div>
<script>
    (async function() {
        const dsURL = 'https://semantify.it/list/wS4r3c9hQ?representation=lean';
        const dsBrowser = new DSBrowser(document.getElementById('test'),'https://semantify.it/ds/rQHgkTdOr');
        await dsBrowser.render();
    })();
</script>
```

## Screenshot

![Example](images/example.png)