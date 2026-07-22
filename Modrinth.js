// ==UserScript==
// @name         Modrinth Anti-Slop
// @namespace    http://tampermonkey.net/
// @version      2026-07-22
// @description  Removes slop from Modrinth. "You're not just panicking—you're going insane."
// @author       You
// @match        https://modrinth.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=modrinth.com
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @run-at       document_start
// ==/UserScript==

(async function() {
    let sloplist = GM_getValue("sloplist");
    if (!sloplist) {
        let array = await (await fetch("https://gist.github.com/Olafcio1/b0fbfa45764c491ba416b3da021aecdd/raw/8e9410ab62a5164a769ec1a9aad3db15654744be/modrinth_sloplist.txt")).text().split("\n");

        sloplist = ``;

        function block(projectID) {
            sloplist += `.search > [role="list"]:first-of-type(1) > div:has(a[href*="${projectID}"]) { display: none; }\n`;
        }

        for (let slop of array) {
            if (slop.startsWith(";")) {
                continue;
            } else if (slop.startsWith("user ")) {
            } else {
                block(slop.substring(slop.lastIndexOf("/") + 1));
            }
        }

        GM_setValue("sloplist", sloplist);
    }

    GM_addStyle(sloplist);
})();
