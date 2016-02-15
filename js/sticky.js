$(document).ready(function () {
    var stickyHeaderTop = $('#pageHeader').offset().top;

    var stickyHeader = function () {
        var scrollTop = $(window).scrollTop();

        if (scrollTop > stickyHeaderTop) {
            $('#pageHeader').addClass('sticky');
        } else {
            $('#pageHeader').removeClass('sticky');
        }
    };

    stickyHeader();

    $(window).scroll(function () {
        stickyHeader();
    });
});