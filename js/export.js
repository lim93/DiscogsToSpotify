$(document).ready(function () {

    $('#waiting').hide();

    var params = getHashParams();
    access_token = params.access_token;

    //Set to false on page load in case the previous export didn't finish
    exportActive = false;

    // Check login state and set userID, country and userName
    if (access_token) {
        $.ajax({
            url: 'https://api.spotify.com/v1/me',
            headers: {
                'Authorization': 'Bearer ' + access_token
            },
            success: function (response) {

                $('#login').hide();
                $('#loggedin').show();

                userID = response.id;
                userCountry = response.country;
                userNameSpotify = response.display_name;

                $('#loggedin').html('<p>Logged in as ' + userNameSpotify + '</p>');
            },
            error: function (xhr, data) {
                window.location = "/index.html";
            }
        });
    } else {
        window.location = "/index.html";
    }

    //TODO: "None of the above"

    // Start-Button
    $("#start").click(function () {

        //Prevent starting the export twice
        if (exportActive == true) {
            return;
        } else(exportActive = true);

        //Reset some of the global values when the start-button is clicked 
        globalArtists = [];
        playlistID = null;
        multipleMatches = [];
        withoutMatches = [];
        addedCount = 0;
        totalReleases = 0;
        adedArtistCount = 0;
        totalArtists = 0;

        userNameDiscogs = $('#user').val();

        $('#imageDiv').empty();
        $('#progressDiv').removeClass('hide');
        updateProgressBar(0);

        //Start after a timeout so the Browser gets time to display the changes
        setTimeout(getCollection, 10, userNameDiscogs, 1);


    });

    $('#start').hover(function () {
        $(this).css('cursor', 'pointer');
    });


    // Make the user choose the right release
    $('#releasesAdded').on('hidden.bs.modal', function (e) {
        exportMultipleMatches();
    });

    // And again after the modal has been hidden
    $('#bestMatch').on('hidden.bs.modal', function (e) {
        exportMultipleMatches();
    });

    // Create Playlist
    $('#collectionFetched').on('hidden.bs.modal', function (e) {
        createPlaylist();
    });

    // Set the progress bar to 100% in the end
    $('#noMatch').on('hidden.bs.modal', function (e) {
        updateProgressBar(100);
    });


});

//Currently active export?
var exportActive = false;

//Global access_token for Spotify
var access_token;

//Global Array with all artists and their releases
var globalArtists;

//Spotify user_id
var userID;

//Spotify country
var userCountry;

//Spotify display_name
var userNameSpotify;

//Discogs UserName
var userNameDiscogs;

//Spotify playlist_id
var playlistID;

//Name of the playlist
var playlistName;

//Array of all releases with multiple matches on Spotify
var multipleMatches = [];

//Array of all releases with no match on Spotify
var withoutMatches = [];

//Count of all releases added to the Playlist
var addedCount = 0;

//How many releases are in the user's collection?
var totalReleases = 0;

//How many artists have already been saved?
var adedArtistCount = 0;

//How many artists are in the user's collection in total?
var totalArtists = 0;


function releaseObject(title, artistName, year) {
    this.title = title;
    this.artistName = artistName;
    this.year = year;
}

function artist(name, releases) {
    this.name = name;
    this.releases = releases;
}

function multipleMatch(release, matches) {
    this.release = release;
    this.matches = matches;
}



/** We don't want duplicate artists in the global array, so this method checks 
if the array contains the given artist (by name) and returns either the position 
in the array or -1. */
function artistsContainsName(name) {

    for (var i = 0; i < globalArtists.length; i++) {
        if (globalArtists[i].name === name) {
            return i;
        }
    }
    return -1;
}

/** We don't want duplicate releases per artist (user could own
more than one copy of a release, e.g. CD and vinyl) */
function releasesContainsTitle(releases, title) {

    for (var i = 0; i < releases.length; i++) {
        if (releases[i].title === title) {
            return true;
        }
    }
    return false;
}

/** Update the progressbar to the given number in percent */
function updateProgressBar(percent) {

    percent = Math.round(percent);

    $('.progress-bar').css('width', percent + '%').attr('aria-valuenow', percent);
    $('#progressNumber').html(percent + '%');
}


/** Entry point. Fetches the user's collection from Discogs */
function getCollection(userName, page) {

    $('#waiting').hide();

    var folderId = 0;

    $.ajax({
        url: 'https://api.discogs.com/users/' + userName + '/collection/folders/' + folderId + '/releases?page=' + page + '&per_page=100',
        type: "GET",
        success: function (result) {

            addArtistsAndReleases(result);

            var currentPage = result.pagination.page;
            var pages = result.pagination.pages;

            //next page
            if (currentPage < pages) {

                var currentProgress = (currentPage / pages) * 20;
                updateProgressBar(currentProgress);

                var nextPage = currentPage + 1;

                //Continue after a timeout so the progress gets updated
                setTimeout(getCollection, 500, userName, nextPage);

            } else {

                //When all pages are loaded, the progress must be 20%
                updateProgressBar(20);

                if (userNameDiscogs.match(/s$/) == 's') {
                    playlistName = userNameDiscogs + "' Discogs Collection";
                } else {
                    playlistName = userNameDiscogs + "'s Discogs Collection";
                }

                $('#collectionFetchedText').html('We fetched a total of ' + totalReleases + ' releases from your Discogs collection.<br /><br />For the next step, we will create the playlist "' + playlistName + '" in your Spotify account and start filling it with the releases from your collection.');
                $("#collectionFetched").modal('show');
            }

        },
        error: function (xhr, data) {

            if (xhr.status == 404) {
                $('#errorModalText').html("Unknown Discogs username. Please try again.");
                $("#errorModal").modal('show');
            } else if (xhr.status == 0) {

                $('#waiting').show();

                //Wait a 'few' seconds, then try again
                setTimeout(getCollection, 61000, userName, page);
            } else if (xhr.status == 401) {
                $('#errorModalText').html("We couldn't fetch your collection from Discogs. Please go to your Discogs <a href='https://www.discogs.com/settings/privacy'>Privacy Settings</a> and make sure that you allow others to browse your collection.");
                $("#errorModal").modal('show');

            } else {
                $('#errorModalText').html("Something went wrong while fetching your collection: " + xhr.status + ". Please try again.");
                $("#errorModal").modal('show');
            }
        }
    });


}

/** Takes the result from Discogs and adds each artist and their releases to the global array (No duplicates!) */
function addArtistsAndReleases(result) {

    $.each(result.releases, function (pos, release) {

        var releaseTitle = release.basic_information.title;
        var releaseYear = release.basic_information.year;
        var releaseArtists = release.basic_information.artists;
        var releaseArtistName = releaseArtists[0].name;

        //Some artists on Discogs have a number in closing round parenthesis behing their name. We don't want these.
        var splitName = releaseArtistName.split(/([(]\d+[)].*)/);
        var artistName = splitName[0];

        var thisRelease = new releaseObject(releaseTitle, artistName, releaseYear);

        var positionInGlobalArray = artistsContainsName(releaseArtistName);

        if (positionInGlobalArray != -1) {

            //Get the artist from the global array
            var thisArtist = globalArtists[positionInGlobalArray];

            //Add this release to the artist's releases, if it's not in the array already
            if (!releasesContainsTitle(thisArtist.releases, thisRelease.title)) {
                thisArtist.releases.push(thisRelease);
                totalReleases++;
            }

        } else {

            //Create new artist with new release-array and add artist to the global array      
            globalArtists.push(new artist(releaseArtistName, new Array(thisRelease)));
            totalReleases++;
            totalArtists++;

        }

    });
}


/** Creates a new playlist in the user's Spotify account, using the Discogs username */
function createPlaylist() {

    $.ajax({
        url: 'https://api.spotify.com/v1/users/' + userID + '/playlists',
        headers: {
            'Authorization': 'Bearer ' + access_token
        },
        data: JSON.stringify({
            "name": playlistName,
            "public": true

        }),
        type: "POST",
        contentType: "application/json; charset=utf-8",
        dataType: 'json',
        success: function (result) {
            playlistID = result.id;

            updateProgressBar(20);

            exportToSpotify();

        },
        error: function (request, xhr, data) {

            $('#errorModalText').html("Something went wrong while creating a Spotify playlist: " + xhr.status + ". Please try again.");
            $("#errorModal").modal('show');

        }
    });

}



/** Gets the next artist from the global array and exports the artist's releases to Spotify */
function exportToSpotify() {

    if (globalArtists.length > 0) {

        var artist = globalArtists[0];
        globalArtists.splice(0, 1);

        var releases = artist.releases;

        $.each(releases, function (pos, release) {

            searchReleaseOnSpotify(release);

        });

        adedArtistCount++;

        //Update Progress AND export next artist
        updateProgress();

    } else {

        $('#releasesAddedText').empty();
        $('#releasesAddedText').append(addedCount + " releases were already added to your Spotify playlist automatically. ");

        if (multipleMatches.length === 1) {
            $('#releasesAddedText').append("For the next release, we will need a little help from you.");
        } else if (multipleMatches.length >= 1) {
            $('#releasesAddedText').append("For the following " + multipleMatches.length + " releases, we will need a little help from you.");
        }

        $("#releasesAdded").modal('show');

    }

}


/** Helper function that calculates the progress based on the number of already exported artists and then 
 * sets a timeout until the next *artist gets exported. This leaves time for the browser to display the updated
 * progress bar and the cover images */
function updateProgress() {

    //Progress bar is at 20% before the first artist is exported and should be at 70% after the last one
    var progress = ((adedArtistCount / totalArtists) * 100 / 2) + 20;
    updateProgressBar(progress);

    // next artist
    setTimeout(exportToSpotify, 100);

}


/** If there are releases with multiple possible matches, we display a modal to make the user decide 
 * which is the right one */
function exportMultipleMatches() {

    if (multipleMatches.length > 0) {

        var match = multipleMatches[0];

        multipleMatches.splice(0, 1);

        $('#bestMatchHeader').empty();
        $('#spotifyDiv').empty();

        var release = match.release;
        var yearString = (release.year != 0) ? " (" + release.year + ")" : "";


        $('#bestMatchHeader').html("<h4 class='modal-title'>Choose the best match for <b>" + release.title + "</b> by " + release.artistName + yearString + "</h4>");

        var matches = match.matches;

        $.each(matches, function (pos, album) {

            var name = album.name;
            var albumID = album.id;
            var imageURL = '../record.png';

            if (album.images.length !== 0) {
                imageURL = album.images[0].url;
            }

            $('#spotifyDiv').append('<div><img src="' + imageURL + '" width="20%" style="display:inline-block; margin:10px; vertical-align:top"><div style="display:inline-block; width:70%"><h4>' + album.name + '</h4><button id="' + albumID + ' ' + imageURL + '" type="button" class="btn btn-success" onClick = "saveAlbumFromMulti(this.id)"><span class="icon-checkmark"></span> Choose this</button></div></div>');

        });

        $('#noMatchButton').html('<span class="icon-cancel-circle"></span> None of the above');

        $("#bestMatch").modal('show');

    } else {
        updateProgressBar(90);
        showNoMatch();
    }

}


/** Reacts to the button in the modal and saves the chosen release to the playlist */
function saveAlbumFromMulti(idAndURL) {

    $("#bestMatch").modal('hide');

    var seperated = idAndURL.split(" ");

    saveAlbumToPlaylist(seperated[0], seperated[1]);

}


/** Displays the modal with all releases without a match on Spotify. End of the export. */
function showNoMatch() {

    $('#noMatchDiv').empty();

    if (withoutMatches.length > 0) {

        $('#noMatchDiv').append("<ul>");

        $.each(withoutMatches, function (pos, release) {

            $('#noMatchDiv').append("<li><b>" + release.artistName + "</b>: " + release.title + " (" + release.year + ")" + "  </li>")
        });

        $('#noMatchDiv').append("</ul>");

        $("#noMatch").modal('show');
        exportActive = false;

    }

}


/** Start a search on Spotify and handle the result */
function searchReleaseOnSpotify(release) {

    var rTitle = release.title;

    if (rTitle.endsWith("EP") || rTitle.endsWith("LP")) {
        rTitle = rTitle.slice(0, -2).trim();
    }

    var query = 'album:"' + rTitle + '" artist:"' + release.artistName + '"';

    $.ajax({
        url: 'https://api.spotify.com/v1/search',
        headers: {
            'Authorization': 'Bearer ' + access_token
        },
        data: {
            q: query,
            type: 'album',
            market: userCountry
        },
        type: "GET",
        success: function (result) {

            handleResultFromSpotify(result, release);
        },
        error: function (request, xhr, data) {

            $('#errorModalText').html("Something went wrong while searching on Spotify: " + xhr.status + ". Please try again.");
            $("#errorModal").modal('show');

        },
        async: false
    });
}


/** Decides if any album from the Spotify-result is a perfect match for the given release,
 * or if the user has to choose the right one manually */
function handleResultFromSpotify(result, release) {

    //Possible matches
    var items = result.albums.items;

    //nothing found
    if (items.length === 0) {
        withoutMatches.push(release);
        return;
    }

    var done = false;

    //Loop to find exact matches
    $.each(items, function (pos, album) {

        var name = album.name;

        //exact match 
        if (!done && name.toLowerCase() === release.title.toLowerCase()) {

            done = true;

            var albumID = album.id;
            var imageURL = '../record.png';

            if (album.images.length !== 0) {
                imageURL = album.images[0].url;
            }

            saveAlbumToPlaylist(albumID, imageURL);

            return;
        }
    });

    //One and only match - hope it's the right one
    if (!done && items.length === 1) {

        done = true;
        var album = items[0];

        var albumID = album.id;
        var imageURL = '../record.png';

        if (album.images.length !== 0) {
            imageURL = album.images[0].url;
        }

        saveAlbumToPlaylist(albumID, imageURL);

        return;
    }

    //More than one possible match - let the user decide
    if (!done && items.length > 1) {

        var m = new multipleMatch(release, items);
        multipleMatches.push(m);

        done = true;
        return;
    }

}

/** Gets an album's tracks and has them saved to the playlist. Adds the cover to the site */
function saveAlbumToPlaylist(albumID, imageURL) {

    return $.ajax({
        url: 'https://api.spotify.com/v1/albums/' + albumID + '/tracks',
        headers: {
            'Authorization': 'Bearer ' + access_token
        },
        data: {
            market: userCountry
        },
        type: "GET",
        success: function (result) {

            saveAlbumTracks(result);

            $('<img src="' + imageURL + '">').load(function () {
                $(this).width('15%').css("margin", "2.5%").appendTo($('#imageDiv'));
            });

        },
        error: function (request, xhr, data) {
            $('#errorModalText').html("Something went wrong while getting the album tracks: " + xhr.status + ". Please try again.");
            $("#errorModal").modal('show');
        },
        async: false
    });

}


/** Saves tracks to the playlist */
function saveAlbumTracks(tracks) {

    var spotifyURIs = [];

    $.each(tracks.items, function (pos, item) {
        spotifyURIs.push(item.uri);
    });

    return $.ajax({
        url: 'https://api.spotify.com/v1/users/' + userID + '/playlists/' + playlistID + '/tracks',
        headers: {
            'Authorization': 'Bearer ' + access_token
        },
        data: JSON.stringify({
            "uris": spotifyURIs
        }),
        type: "POST",
        contentType: "application/json; charset=utf-8",
        dataType: 'json',
        success: function (result) {
            addedCount++;

        },
        error: function (request, xhr, data) {

            $('#errorModalText').html("Something went wrong while saving the tracks to your playlist: " + xhr.status + ". Please try again.");
            $("#errorModal").modal('show');

        },
        async: false
    });
}


/** Gets parameters from the hash of the URL */
function getHashParams() {
    var hashParams = {};
    var e, r = /([^&;=]+)=?([^&;]*)/g,
        q = window.location.hash.substring(1);
    while (e = r.exec(q)) {
        hashParams[e[1]] = decodeURIComponent(e[2]);
    }
    return hashParams;
}