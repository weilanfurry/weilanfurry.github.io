//WOW JS INIT
(function($) {
    new WOW().init();
})(jQuery);
//CUSTOMER REVIEW  SLIDER
var swiper = new Swiper(".customer-review", {

    loop: false,
    autoplay: {
        delay: 4500,
        disableOnInteraction: false,
    },
    pagination: {
        el: ".swiper-pagination",
        dynamicBullets: true,
        clickable: true,
    },
});

// FOR CURRENT PAGE ACTIVE NAVBAR
$(function() {
    var url = window.location.href;
    url = url.substring(0, (url.indexOf("#") == -1) ? url.length : url.indexOf("#"));
    url = url.substring(0, (url.indexOf("?") == -1) ? url.length : url.indexOf("?"));
    url = url.substr(url.lastIndexOf("/") + 1);

    if (url == '') {
        url = 'index.html';
    }
    $('.menu-list').each(function() {
        var href = $(this).find('a').attr('href');
        if (url == href) {
            $(this).addClass('active');
        }
    });
});

// =========toggle icon=======
// Hamburger-menu
$('.hamburger-menu').on('click', function() {
    $('.hamburger-menu .line-top, #menu').toggleClass('current');
    $('.hamburger-menu .line-center').toggleClass('current');
    $('.hamburger-menu .line-bottom').toggleClass('current');
});

$(".hamburger-menu").click(function() {
    $(".side-bar").toggleClass("active");
});

// ===========preloader=============
$(window).on('load', function() {
    $("#preloader").delay(600).fadeOut();
});

// ====================dark and light ============

// FOR TOGGLE SWITCH DARK & LIGHT THEME
const btn = document.querySelector(".night__mood");
const theme = document.querySelector("#change-mood");
const storedTheme = localStorage.getItem('#change-mood');
if (storedTheme) {
    theme.href = storedTheme;
}
btn.addEventListener("click", function() {
    if (theme.getAttribute("href") == "assets/css/style.css") {
        theme.href = "assets/css/dark.css";
    } else {
        theme.href = "assets/css/style.css";
    }
    localStorage.setItem('#change-mood', theme.href)

});