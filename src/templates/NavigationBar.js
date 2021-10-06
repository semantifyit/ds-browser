const NavigationBar = `
<!-- Navbar-->
<nav class="navbar navbar-expand-lg navbar-light bg-light">
  <div class="container-xl justify-content-between">
    <!-- Left elements -->
    <ul class="navbar-nav flex-row d-flex" style="min-width: 100px;">
        <li class="nav-item me-3 me-lg-1">
           <a id="nav-list-button" class="nav-link {{listBtnClass}}" href="{{listBtnHref}}">
            <span><i class="far fa-list-alt fa-sm"></i></span>
            <span id="nav-list-button-text">{{listName}}</span>
          </a>
        </li>
    </ul>
    <!-- Left elements -->

    <!-- Center elements -->
    <ul class="navbar-nav flex-row d-flex">
      <li class="nav-item me-3 me-lg-1">
        <a class="nav-link active" href="#">
         Native view
        </a>
      </li>
      <li class="nav-item me-3 me-lg-1">
        <a class="nav-link" href="#">
          Tree view
        </a>
      </li>
      <li class="nav-item me-3 me-lg-1">
        <a class="nav-link" href="#">
          Hierarchy view
        </a>
      </li>
    </ul>
    <!-- Center elements -->

    <!-- Right elements -->
    <ul class="navbar-nav flex-row" style="min-width: 100px;">
      <li class="nav-item me-3 me-lg-1">
        <a class="nav-link {{editDsClass}}" href="{{editDsHref}}">
          <span><i class="fas fa-edit fa-sm"></i></span>
          <span>Edit DS</span>
        </a>
      </li>
      <li class="nav-item me-3 me-lg-1">
        <a class="nav-link d-sm-flex align-items-sm-center" href="#">
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
