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
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// @run-at       document_start
// @connect      github.com
// @connect      raw.githubusercontent.com
// ==/UserScript==

(function() {
    let sloplist = GM_getValue("sloplist"),
        manual = false;

    const DAY = 1000/*second*/ * 60/*minute*/ * 60/*hour*/ * 24/*day*/;

    async function PerformUpdate() {
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

        class Executor {
            #cid;
            #channels;
            #maxBuffer;
            #bufferPolling;

            constructor(channels, { pollingDelay = 10, pollingDiff = 0, maxBuffer = 6, bufferPolling = 200 } = {}) {
                this.#maxBuffer = maxBuffer;
                this.#bufferPolling = bufferPolling;
                this.#channels = new Array(channels);
                this.#cid = 0;

                for (let zz = 0; zz < channels; zz++) {
                    const list = [];

                    this.#channels[zz] = list;

                    setTimeout(
                        () => Executor.#handle(list, pollingDelay),
                        zz * pollingDiff
                    );
                }
            }

            async execute(fun) {
                let funs = this.#channels[this.#cid];
                while (funs.length > this.#maxBuffer)
                    await new Promise(rsv => setTimeout(rsv, this.#bufferPolling));

                funs.push(fun);

                this.#cid = (this.#cid + 1) % this.#channels.length;
            }

            async executeTimeouted(fun, timeout) {
                let funs = this.#channels[this.#cid];
                while (funs.length > this.#maxBuffer)
                    await new Promise(rsv => setTimeout(rsv, this.#bufferPolling));

                funs.push(async () => {
                    await fun();
                    await new Promise(rsv => setTimeout(rsv, timeout));
                });

                this.#cid = (this.#cid + 1) % this.#channels.length;
            }

            async finish(pollingDelay = 200) {
                while (true) {
                    exit: {
                        for (let chan of this.#channels)
                            if (chan.length != 0)
                                break exit;

                        return;
                    }

                    await new Promise(rsv => setTimeout(rsv, pollingDelay));
                }
            }

            static paused = 0;

            static async #handle(list, pollingDelay) {
                while (true) {
                    do {
                        await new Promise(rsv => setTimeout(rsv, pollingDelay));
                    } while (this.paused > 0);

                    let entries = list.length;

                    for (let fi = 0; fi < entries; fi++) {
                        await list.shift()();
                    }
                }
            }
        }

        //TODO Use cors proxies lmfao

        /** request */ let executor = new Executor(3, { pollingDelay: 11, pollingDiff: 2, maxBuffer: 7 });
        /** storage */ let executor2 = new Executor(3, { pollingDelay: 7, pollingDiff: 1, maxBuffer: 20 });
        /** block   */ let executor3 = new Executor(1, { pollingDelay: 70, maxBuffer: 20 });

        let getStorage = manual == "reset"  ? id => null  : id => GM_getValue(id);

        function cloudflare() {
            let iframe = document.createElement("iframe");

            iframe.src = location.href.split("?")[0].split("&")[0].split("slop")[0];
            iframe.style.position='fixed';
            iframe.style.inset='0';

            document.body.appendChild(iframe);

            return iframe;
        }

        async function doRequest(url) {
            while (true) {
                try {
                    let resp = await fetch(url);
                    if (resp.status == 429) {
                        Executor.paused++;

                        if (Executor.paused == 1) {
                            let el = cloudflare();
                            await new Promise(rsv => setTimeout(rsv, 2400 + ~~(Math.random()*3000)));

                            el.remove();
                        } else {
                            await new Promise(rsv => setTimeout(rsv, 2400 + ~~(Math.random()*3000)));
                        }

                        Executor.paused--;

                        continue;
                    }

                    return await resp.text();
                } catch {
                    await new Promise(rsv => setTimeout(rsv, 1000));
                }
            }
        }

        let i = 0;
        for (let slop of array) {
            if (slop.startsWith(";") || !slop.trim()) {
                i++;
                continue;
            } else if (slop.startsWith("org ")) {
                const id = slop.substring(4);
                let projects = getStorage("o" + id);

                (async (projects) => await executor[projects ? 'execute' : 'executeTimeouted'](async () => {
                    if (!projects) {
                        projects = await doRequest(`https://api.modrinth.com/v3/organization/${id}/projects`);
                    }

                    executor2.execute(() => {
                        GM_setValue("o" + id, projects);
                    });

                    if (projects[0] == '[') {
                        let projectsJSON = JSON.parse(projects);
                        for (const { slug } of projectsJSON) {
                            executor3.execute(() => block(slug));
                        }
                    }
                }, 40))(projects);
            } else if (slop.startsWith("user ")) {
                const id = slop.substring(5);
                let projects = getStorage("u" + id);

                (async (projects) => await executor[projects ? 'execute' : 'executeTimeouted'](async () => {
                    if (!projects) {
                        projects = await doRequest(`https://api.modrinth.com/v3/user/${id}/projects`);
                    }

                    executor2.execute(() => {
                        GM_setValue("u" + id, projects);
                    });

                    if (projects[0] == '[') {
                        let projectsJSON = JSON.parse(projects);
                        for (const { slug } of projectsJSON) {
                            executor3.execute(() => block(slug));
                        }
                    }
                }, 40))(projects);
            } else {
                await executor3.execute(() => {
                    block(slop.substring(slop.lastIndexOf("/") + 1));
                });
            }

            container.style.setProperty("--sloplist-full",Math.round((i++/array.size)*100)+"%");
        }

        await executor.finish();
        await executor2.finish();
        await executor3.finish();

        GM_setValue("sloplist", sloplist);
        GM_setValue("lastupdate", Date.now());

        GM_addStyle(sloplist);

        container.children[0].append((manual ? "Manual" : "First-time") + " slop update performed.\nIndexed slops: " + amount);

        let btn = document.createElement("sloplist-btn");
        btn.innerText = 'Ok';
        btn.addEventListener("click", () => {
            container.remove();
        }, { once: true });

        container.children[0].append(btn);
    }
    
    // TODO Remove spaghetti code
    if (!sloplist || (manual=(location.href.includes("force-reset-slop")?"reset":(location.href.includes("reset-slop")?"add":false)))) {
        (async () => {
            if (manual)
                alert("Performing manual slop update.\nClick OK to accept");

            PerformUpdate();
        })();
    } else {
        GM_addStyle(sloplist);

        if (!GM_getValue("lastupdate") || Date.now() - parseInt(GM_getValue("lastupdate")) >= DAY) {
            let el = document.createElement("div");
            document.body.appendChild(el);
    
            el.outerHTML = `
            <div id="update-sloplist-btn" class="btn-wrapper outline text-base" style="display:flex;position:fixed;z-index:3333;left:5px;bottom:20px;scale:.8;outline:none;--_bg:transparent;--_text:var(--color-base);--_hover-bg:transparent;--_hover-text:var(--color-base);--_box-shadow:none;--_height:3rem;--_width:auto;--_radius:1rem;--_padding-x:calc(1rem - 0.125rem);--_padding-y:0.75rem;--_gap:0.5rem;--_font-weight:800;--_icon-size:1.5rem;--_outline-color:var(--surface-5);" data-v-f81a2b1e="" data-v-fd3b428f=""><!--[--><a href="javascript:void(0);" class="" data-v-f81a2b1e="" data-v-fd3b428f-s="">
            
            <svg data-v-d971e218="" data-v-fd3b428f-s="" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1m-4-4-4 4m0 0-4-4m4 4V4"></path></svg>
            
            Update SlopList
            
            </a><!--]--></div>
            `;
    
            (el = document.querySelector("#update-sloplist-btn")).addEventListener("click", () => {
                manual = true;
                PerformUpdate();
                el.remove();
            }, { once: true });
        }

        GM_registerMenuCommand("Check sloplist updates", () => {
            manual = true;
            PerformUpdate();
        }, "check-updates");
    }

    GM_registerMenuCommand("Visit script page", () => {
        GM_openInTab("https://github.com/Olafcio1/SlopList", { active: true });
    }, "visit-script");

    GM_registerMenuCommand("Visit Olafcio1 page", () => {
        GM_openInTab("https://github.com/Olafcio1", { active: true });
    }, "visit-script");
})();
