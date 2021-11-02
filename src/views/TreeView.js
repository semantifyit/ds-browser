const DSTitleFrame = require("../templates/DsTitle.js");

class TreeView {
  constructor(dsBrowser) {
    this.b = dsBrowser;
    this.dsHandler = this.b.dsHandler;
  }

  // renders (creates and appends) this view
  render() {
    // creates the html code for this view
    let nativeHtml = this.getFrame();

    // set html for navigationBar
    nativeHtml = nativeHtml.replace(
      /{{navigationBar}}/g,
      this.b.sharedFunctions.getNavigationBarHTML()
    );

    // set ds title
    nativeHtml = this.b.sharedFunctions.setDsTitleHtml(nativeHtml);

    // append the view to the DSB main container
    this.b.dsbContainer.innerHTML = nativeHtml;
    // initialize the tree iframe
    this.initIFrameForJSTree();
  }

  // returns the base html code for this view
  getFrame() {
    return `<div id="tree-view" class="withNav">
      <!--Navigation Bar-->
      {{navigationBar}}
      <!--Page content-->
      <div class="container-xl">
        <!--Title-->
        ${DSTitleFrame}
        <!--tree iframe-->
        <div id="div-iframe">
          <iframe id="iframe-jsTree" frameborder="0" width="100%" scrolling="no"></iframe>
        </div>
      </div>
    </div>`;
  }

  initIFrameForJSTree() {
    this.iFrame = this.b.dsbContext.getElementById("iframe-jsTree");
    this.iFrameCW = this.iFrame.contentWindow;
    const doc = this.iFrameCW.document;
    const jsTreeHtml = this.createJSTreeHTML();
    doc.open();
    doc.write(jsTreeHtml);
    doc.close();
    const dsClass = this.dsHandler.generateDsClass(
      this.b.dsRootNode,
      false,
      true
    );
    this.mapNodeForJSTree([dsClass]);
  }

  createJSTreeHTML() {
    const htmlTreeStyle = this.createTreeStyle();
    // JQuery is needed for the JSTree plugin
    return `<head>
            <script src="https://code.jquery.com/jquery-3.6.0.min.js" crossorigin="anonymous"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/jstree/3.3.10/jstree.min.js"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/jstreegrid/3.10.2/jstreegrid.min.js"></script>
            <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/css/bootstrap.min.css" />
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/jstree/3.3.10/themes/default/style.min.css" />
            ${htmlTreeStyle}
            </head>
            <body><div id="jsTree"></div></body>`;
  }

  createTreeStyle() {
    return `<style>
            .optional-property { color: #ffa517; }
            .mandatory-property { color: #00ce0c; }
            </style>`;
  }

  mapNodeForJSTree(data) {
    const self = this;
    this.iFrame.addEventListener("load", function () {
      self.iFrameCW
        .$("#jsTree")
        .jstree({
          plugins: ["grid"],
          core: {
            themes: {
              icons: true,
              dots: true,
              responsive: true,
              stripes: true,
              rootVisible: false,
            },
            data: data,
          },
          grid: {
            columns: [
              {
                width: "20%",
                header: "Class / Property",
              },
              {
                header: "Range / Type",
                width: "20%",
                value: function (node) {
                  return node.data.dsRange;
                },
              },
              {
                width: "17%",
                header: "Cardinality",
                value: function (node) {
                  if (node.data.dsRange) {
                    return (
                      '<p style="width: 100%; margin: 0; text-align: center; padding-right: 7px;">' +
                      self.dsHandler.createHtmlCardinality(
                        node.data.minCount,
                        node.data.maxCount
                      ) +
                      "</p>"
                    );
                  }
                },
              },
              {
                width: "50%",
                header: "Description",
                value: function (node) {
                  return (
                    '<p style="width: 100%; overflow: hidden; margin: 0; text-overflow: ellipsis;">' +
                    node.data.dsDescription.replaceAll("</br>", " ") +
                    "</p>"
                  );
                },
              },
            ],
          },
        })
        .bind(
          "ready.jstree after_open.jstree after_close.jstree refresh.jstree",
          self.adaptIframe.bind(self)
        );
      self.addIframeClickEvent();
    });
  }

  adaptIframe() {
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    this.iFrame.height = "0px";
    this.iFrame.height = this.iFrameCW.document.body.scrollHeight;
    window.scrollTo(scrollX, scrollY); // todo is this correct?
  }

  addIframeClickEvent() {
    // todo use tree js plugins for this optiopnal/mandatory functionality
    this.iFrameCW.$(".btn-vis-shadow").click((event) => {
      const $button = this.iFrameCW.$(event.currentTarget);

      // $button.removeClass("btn-vis-shadow");
      let $otherButton, showOptional;
      showOptional = true;
      // if ($button.attr("id") === "btn-opt") {
      //   $otherButton = this.iFrameCW.$("#btn-man");
      //   showOptional = true;
      // } else {
      //   $otherButton = this.iFrameCW.$("#btn-opt");
      //   showOptional = false;
      // }
      // $otherButton.addClass("btn-vis-shadow");
      $button.off("click");
      this.addIframeClickEvent();

      const dsClass = this.dsHandler.generateDsClass(
        this.b.dsRootNode,
        false,
        showOptional
      );
      const jsTree = this.iFrameCW.$("#jsTree").jstree(true);
      jsTree.settings.core.data = dsClass;
      jsTree.refresh();
    });
  }
}

module.exports = TreeView;
