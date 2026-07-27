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
// @connect      github.com
// @connect      raw.githubusercontent.com
// ==/UserScript==

(function() {
    let sloplist = GM_getValue("sloplist"),
        manual = false;

    // TODO Remove spaghetti code
    if (!sloplist || (manual=(location.href.includes("force-reset-slop")?"reset":(location.href.includes("reset-slop")?"add":false)))) {  // TODO Script context menu to update this!!!
                                                                       //      Also an auto update every hour or something
        (async () => {
            if (manual)
                alert("Performing manual slop update.\nClick OK to accept");

            GM_addStyle(`
                sloplist-panel {
                    background: #00000015;
                    position: fixed;
                    inset: 0;
                    z-index: 5;
                    backdrop-filter: blur(5px) contrast(0.9);
                    display: grid;
                    place-items: center;

                    &, * { margin: 0; padding: 0; box-sizing: border-box }
                }

                sloplist-child {
                    padding: 22px;
                    text-align: center;
                    background: #0005;
                    border-radius: 15px;
                    box-shadow: 0 0 15px #0004;
                    display: grid;
                    gap: 8px;

                    > .status {
                        border-radius: 8px;
                        background: #fff2;
                        box-shadow: 0 0 15px #0003;
                        width: 100%;
                        height: 5px;
                        position: relative;
                        margin-block: 4px 5px;

                        &::before {
                            content: '';
                            border-radius: 7px;
                            position: absolute;
                            left: 0;
                            top: 0;
                            height: inherit;
                            width: var(--sloplist-full, 0%);
                            background: currentColor;
                            transition: width .15s ease-in-out;
                        }
                    }
                }

                sloplist-btn {
                    display: inline-block;
                    cursor: pointer;
                    margin-top: 5px;
                    background: #fff1;
                    border-radius: 8px;
                    padding: 5px 10px;
                    box-shadow: 0 0 15px #0003;
                }
            `);

            let container= document.createElement("sloplist-panel");
            container.innerHTML=`<sloplist-child><p style="font-size: 1.1em">Updating sloplist</p><div class="status"></div></sloplist-child>`;
            document.body.appendChild(container);

            let array = (await GM.xmlHttpRequest({
                url: "https://github.com/Olafcio1/SlopList/raw/refs/heads/main/Modrinth%20SlopList.txt",
                nocache: true
            })).responseText.replace("\r", "\n").split("\n");

            array = new Set(array);
            sloplist = ``;

            let amount = 0;

            function block(projectID) {
                sloplist += `.search > [role="list"]:first-of-type > div:has(a[href*="${projectID}"]) { display: none; }\n`;
                amount++;
            }

            let i = 0;
            for (let slop of array) {
                if (slop.startsWith(";") || !slop.trim()) {
                    i++;
                    continue;
                } else if (slop.startsWith("org ")) {
                    let projects;
                    let id = slop.substring(4);

                    try {
                        //Force reset
                        if (manual == "reset")
                            throw new Error();

                        projects = GM_getValue("o" + id);

                        //TODO Optimize
                        if (projects)
                            projects = JSON.parse(projects);
                        else throw new Error();
                    } catch {
                        projects ??= await (await fetch(`https://api.modrinth.com/v3/organization/${id}/projects`)).json();

                        (async (projects,id) => {
                            GM_setValue("o" + id, JSON.stringify(projects));
                        })(projects,id);
                    }

                    if (projects instanceof Array)
                        for (let { slug } of projects)
                            block(slug);
                } else if (slop.startsWith("user ")) {
                    let projects;
                    let id = slop.substring(5);

                    try {
                        //Force reset
                        if (manual == "reset")
                            throw new Error();

                        projects = GM_getValue("u" + id);

                        //TODO Optimize
                        if (projects)
                            projects = JSON.parse(projects);
                        else throw new Error();
                    } catch {
                        projects ??= await (await fetch(`https://api.modrinth.com/v3/user/${id}/projects`)).json();

                        (async (projects,id) => {
                            GM_setValue("u" + id, JSON.stringify(projects));
                        })(projects,id);
                    }

                    if (projects instanceof Array)
                        for (let { slug } of projects)
                            block(slug);
                } else {
                    block(slop.substring(slop.lastIndexOf("/") + 1));
                }
                container.style.setProperty("--sloplist-full",Math.round((i++/array.size)*100)+"%");
            }

            GM_setValue("sloplist", sloplist);
            GM_addStyle(sloplist);

            container.children[0].append((manual ? "Manual" : "First-time") + " slop update performed.\nIndexed slops: " + amount);

            let btn = document.createElement("sloplist-btn");
            btn.innerText = 'Ok';
            btn.addEventListener("click", () => {
                container.remove();
            }, { once: true });

            container.children[0].append(btn)
        })();

        return;
    }

    GM_addStyle(sloplist);
})();
