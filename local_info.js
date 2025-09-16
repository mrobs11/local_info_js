/**
 * JavaScript for handling local time and (placeholder) weather information.
 * This script aims to replicate the time calculation logic found in the
 * CakePHP ClientsController::local_info action.
 */

(function ($) {
  // Encapsulate in an IIFE to avoid global scope pollution and ensure jQuery is available

  // Your OpenWeatherMap API Key
  // IMPORTANT: In a production environment, you should proxy this request through your backend
  // to avoid exposing your API key directly in client-side code.
  // NWS API and Nominatim Geocoding
  const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search";
  const NWS_POINTS_BASE_URL = "https://api.weather.gov/points/";
  const USER_AGENT = "fmwidgets_rdi_weather_app (your_email@example.com)"; // Replace with a real email

  /**
   * Formats a Date object into 'h:mma' (e.g., '3:30pm').
   * This is a simplified version of what a full date formatting library would do.
   * @param {Date} date - The Date object to format.
   * @returns {string} The formatted time string.
   */
  function formatTime(date) {
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? "pm" : "am";
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    minutes = minutes < 10 ? "0" + minutes : minutes;
    return hours + ":" + minutes + ampm;
  }

  /**
   * Parses the current URL pathname to extract zip and timezone offset.
   * Expected format: /clients/local_info/{zip}/{timezone_offset}
   * @returns {{zip: string, timezoneOffset: number}|null} An object with zip and timezoneOffset, or null if not found.
   */
  function parseLocalInfoFromUrl() {
    const path = window.location.pathname;
    const match = path.match(/\/clients\/local_info\/(\d+)\/(-?\d+)/);

    if (match && match.length === 3) {
      return {
        zip: match[1],
        timezoneOffset: parseInt(match[2], 10),
      };
    }
    return null;
  }

  /**
   * Fetches and displays local time and weather information.
   * @param {string} [zipFromArg] - Optional zip code provided as an argument.
   * @param {number} [timezoneOffsetFromArg] - Optional timezone offset provided as an argument.
   * @param {string} contentElementId - The ID of the HTML element to update with the content.
   */
  window.loadLocalInfo = function (
    zipFromArg,
    timezoneOffsetFromArg,
    contentElementId = "content",
  ) {
    const $content = $("#" + contentElementId);

    let zip = zipFromArg;
    let timezoneOffset = timezoneOffsetFromArg;

    // If zip or timezoneOffset are not provided as arguments, try to parse them from the URL
    if (zip === undefined || timezoneOffset === undefined) {
      const urlInfo = parseLocalInfoFromUrl();
      if (urlInfo) {
        zip = urlInfo.zip;
        timezoneOffset = urlInfo.timezoneOffset;
      } else {
        // If still no info, log an error or handle as needed
        console.error(
          "Could not determine zip or timezone offset from arguments or URL.",
        );
        $content.html(
          '<div id="title">Error: Missing zip or timezone info</div>',
        );
        return; // Stop execution if essential info is missing
      }
    }

    if (!zip) {
      $content.html(
        '<div id="title">Error: Zip code is required for weather info</div>',
      );
      return;
    }

    // Function to update only the time part
    const updateTimeOnly = () => {
      const currentTime = new Date();
      currentTime.setHours(currentTime.getHours() + timezoneOffset);
      $("#time").html(formatTime(currentTime));
    };

    // Initial render with loading state for weather, and start time update
    $content.html(`
      <div id="time-weather-label">Current time and weather there</div>
      <div id="time-weather-container">
        <div id="time"></div>
        <div id="weather-info">
          <span id="temp">Loading...</span>
          <span id="weather-description"></span>
          <span id="icon"></span>
        </div>
      </div>
    `);
    updateTimeOnly();
    setInterval(updateTimeOnly, 1000); // Refresh the clock every second

    // Step 1: Geocode zip code to lat/lon using Nominatim
    $.ajax({
      url: `${NOMINATIM_BASE_URL}?q=${zip}&format=json&limit=1&countrycodes=us`, // Added countrycodes=us
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
      },
      success: function (geocodeData) {
        if (geocodeData && geocodeData.length > 0) {
          const lat = geocodeData[0].lat;
          const lon = geocodeData[0].lon;

          // Step 2: Get NWS forecast grid point
          $.ajax({
            url: `${NWS_POINTS_BASE_URL}${lat},${lon}`,
            method: "GET",
            headers: {
              "User-Agent": USER_AGENT,
            },
            success: function (pointData) {
              const forecastUrl = pointData.properties.forecastHourly;

              if (forecastUrl) {
                // Step 3: Get hourly forecast
                $.ajax({
                  url: forecastUrl,
                  method: "GET",
                  headers: {
                    "User-Agent": USER_AGENT,
                  },
                  success: function (forecastData) {
                    if (
                      forecastData.properties &&
                      forecastData.properties.periods &&
                      forecastData.properties.periods.length > 0
                    ) {
                      const currentPeriod = forecastData.properties.periods[0];
                      const temperature = currentPeriod.temperature;
                      const temperatureUnit = currentPeriod.temperatureUnit;
                      const weatherDescription = currentPeriod.shortForecast;
                      // NWS API doesn't provide direct icons like OpenWeatherMap,
                      // so we'll just display text for now.
                      // You could map shortForecast to custom icons if needed.

                      $("#temp").html(`${temperature}&deg;${temperatureUnit}`);
                      $("#weather-description").html(weatherDescription);
                      $("#icon").empty(); // Clear any previous icon placeholder
                    } else {
                      $("#temp").html("N/A");
                      $("#weather-description").html("No forecast data.");
                      $("#icon").empty();
                    }
                  },
                  error: function (jqXHR, textStatus, errorThrown) {
                    console.error(
                      "Error fetching NWS forecast:",
                      textStatus,
                      errorThrown,
                    );
                    $("#temp").html("Error");
                    $("#weather-description").html("Forecast failed.");
                    $("#icon").empty();
                  },
                });
              } else {
                $("#temp").html("N/A");
                $("#weather-description").html("No forecast URL.");
                $("#icon").empty();
              }
            },
            error: function (jqXHR, textStatus, errorThrown) {
              console.error(
                "Error fetching NWS grid point:",
                textStatus,
                errorThrown,
              );
              $("#temp").html("Error");
              $("#weather-description").html("Grid point failed.");
              $("#icon").empty();
            },
          });
        } else {
          console.error("Geocoding failed for zip:", zip);
          $("#temp").html("Error");
          $("#weather-description").html("Invalid zip code.");
          $("#icon").empty();
        }
      },
      error: function (jqXHR, textStatus, errorThrown) {
        console.error("Error geocoding zip code:", textStatus, errorThrown);
        $("#temp").html("Error");
        $("#weather-description").html("Geocoding failed.");
        $("#icon").empty();
      },
    });
  };

  // Example usage (you would call this from your HTML or another script)
  // If called without arguments, it will attempt to parse from the URL.
  // e.g., window.loadLocalInfo(); when URL is /clients/local_info/92646/-3
  // Or, you can still provide arguments: window.loadLocalInfo('92646', -3, 'my-local-info-div');
})(jQuery);
