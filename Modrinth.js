// ==UserScript==
// @name         Modrinth Anti-Slop
// @namespace    http://tampermonkey.net/
// @version      2026-07-22
// @description  Removes slop from Modrinth. "You're not just panicking—you're going insane."
// @author       Olafcio
// @match        https://modrinth.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=modrinth.com
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @run-at       document_start
// @connect      gist.github.com
// @connect      gist.githubusercontent.com
// ==/UserScript==

(function() {
    let sloplist = GM_getValue("sloplist");
    if (!sloplist || location.href.includes("reset-slop")) {  // TODO Script context menu to update this!!!
                                                               //      Also an auto update every hour or something
        (async () => {
            let array = (await GM.xmlHttpRequest({
                url: "https://github.com/Olafcio1/SlopList/raw/refs/heads/main/Modrinth%20SlopList.txt"
            })).responseText.replace("\r", "\n").split("\n");

            sloplist = ``;

            function block(projectID) {
                sloplist += `.search > [role="list"]:first-of-type > div:has(a[href*="${projectID}"]) { display: none; }\n`;
            }

            for (let slop of array) {
                if (slop.startsWith(";") || !slop.trim()) {
                    continue;
                } else if (slop.startsWith("user ")) {
                    let projects = await (await fetch(`https://api.modrinth.com/v3/user/${slop.substring(5)}/projects`)).json();
                    if (projects instanceof Array)
                        for (let { slug } of projects)
                            block(slug);
                } else {
                    block(slop.substring(slop.lastIndexOf("/") + 1));
                }
            }

            GM_setValue("sloplist", sloplist);
            GM_addStyle(sloplist);
        })();

        return;
    }

    GM_addStyle(sloplist);
})();
