// ==UserScript==
// @name        WaniKani Exact Review Time
// @namespace   goldenchrysus.wanikani.exactreviewtime
// @description Shows actual time of next review
// @version     1.1.0
// @include     https://www.wanikani.com/dashboard*
// @require     https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.22.2/moment.min.js
// @copyright   2018+, Patrick Golden
// @license     MIT; http://opensource.org/licenses/MIT
// @run-at      document-end
// @grant       none
// ==/UserScript==

(function() {
	"use strict";

	// Establish important variables
	let key               = "goldenchrysus_wanikani_exactreviewtime";
	let $time             = $(".timeago");
	let observer          = new window.MutationObserver(updateReviewBlock);
	let timeout_available = false;
	let timeout_countdown = false;
	let wkof              = window.wkof || {};
	let modules           = "Menu, Settings";
	let settings_modal    = false;

	if (window.wkof) {
		wkof.include(modules);
		wkof
			.ready(modules)
			.then(startup);
	}

	// Track changes to .timeago in order to override changes created by WaniKani
	observer.observe(
		$time[0],
		{
			characterData : true,
			childList     : true,
			attributes    : true,
			subtree       : true
		}
	);
	updateReviewBlock();

	function startup() {
		let defaults = {
			twenty_four_hour : false
		};

		wkof.Settings
			.load(key, defaults)
			.then(initializeSetup);
	}

	function initializeSetup() {
		wkof.Menu.insert_script_link({
			name     : key,
			submenu  : "Exact Review Time",
			title    : "Settings",
			on_click : openSettingsModal
		});

		settings_modal = new wkof.Settings({
			script_id : key,
			title     : "Exact Review Time Settings",
			on_save   : updateReviewBlock,
			content   : {
				twenty_four_hour : {
					type  : "checkbox",
					label : "24-Hour Time Format"
				}
			}
		});

		settings_modal
			.load()
			.then(updateReviewBlock);
	}

	function openSettingsModal() {
		settings_modal.open();
	}

	/**
	 * Updates the time or countdown until the next review
	 */
	function updateReviewBlock() {
		let timestamp        = +$time.attr("datetime");
		let milliseconds     = timestamp * 1000;
		let now_milliseconds = +moment().format("x");
		let in_future        = (milliseconds > now_milliseconds);
		let format           = (wkof.settings && wkof.settings[key] && wkof.settings[key].twenty_four_hour) ? "HH:mm" : "h:mm a";
		let time             = (!in_future) ? "Available now" : moment(milliseconds).format(format);
		let difference       = Math.floor((milliseconds - now_milliseconds) / 1000);

		// If time until next review is <= 30 minutes, swap to "# minutes" text
		if (in_future && difference <= 1800) {
			let minutes       = Math.ceil(difference / 60) || 1;
			let plural        = (minutes === 1) ? "" : "s";
			let original_time = time;
			let $parent       = $time.closest(".next");

			time = `${minutes} minute${plural}`;

			// Run this function again in 30 seconds to get updated minute count
			setTimeout(updateReviewBlock, 30000);

			// Maintain exact time feature by injecting a new element adjacent to WaniKani's "Next Review" text
			let $small     = $parent.find("small.exact");
			let small_text = `@ ${original_time}`;

			if (!$small.length) {
				let $small = $(`<small class="exact">${small_text}</small>`);

				$parent.append($small);
			} else if ($small.html() !== small_text) {
				$small.html(small_text)
			}
		// otherwise ensure this function runs when 30 minutes remain if there are currently more than 30 minutes left
		} else if (in_future && !timeout_countdown) {
			timeout_countdown = setTimeout(updateReviewBlock, milliseconds - (30 * 60 * 1000));
		}

		// Only update the time HTML if it doesn't match this function's output in order to avoid infinite recursion by MutationObserver
		if ($time.html() !== time) {
			$time.html(time);
		}

		// Set a timeout for 1 millisecond after the next review time in order to generate the "Available now" text
		if (in_future && !timeout_available) {
			timeout_available = setTimeout(updateReviewBlock, milliseconds - now_milliseconds + 1);
		}
	}
}());
