const NavigationBar = `
<!-- Navbar-->
<nav class="navbar navbar-expand-lg navbar-light bg-light fixed-top">
  <div class="container-xl justify-content-between">
    <!-- Left elements -->
    <ul class="navbar-nav flex-row d-flex" style="min-width: 100px;">
        <li class="nav-item me-3 me-lg-1">
           <a id="nav-list-button" class="nav-link a-js-link {{listBtnClass}}" {{listBtnAttributes}}">
            <span><i class="far fa-list-alt fa-sm"></i></span>
            <span id="nav-list-button-text">{{listName}}</span>
          </a>
        </li>
    </ul>
    <!-- Left elements -->

    <!-- Center elements -->
    <ul class="navbar-nav flex-row d-flex">
      <li class="nav-item me-3 me-lg-1">
        <a class="nav-link a-js-link {{nativeViewBtnClass}}" {{nativeViewBtnAttributes}}>
         Native view
        </a>
      </li>
      <li class="nav-item me-3 me-lg-1">
        <a class="nav-link a-js-link {{treeViewBtnClass}}" {{treeViewBtnAttributes}}>
          Tree view
        </a>
      </li>
      <li class="nav-item me-3 me-lg-1">
        <a class="nav-link a-js-link" href="#">
          Hierarchy view
        </a>
      </li>
    </ul>
    <!-- Center elements -->

    <!-- Right elements -->
    <ul class="navbar-nav flex-row" style="min-width: 100px;">
      <li class="nav-item me-3 me-lg-1">
        <a class="nav-link align-items-sm-center a-js-link {{shaclViewBtnClass}}" {{shaclViewBtnAttributes}}">
         <span><i class="far fa-file-code fa-sm me-1"></i></span>
           <span>SHACL</span>
        </a>
      </li>
    </ul>
    <!-- Right elements -->
  </div>
</nav>
<!-- Navbar -->
`;

module.exports = NavigationBar;
