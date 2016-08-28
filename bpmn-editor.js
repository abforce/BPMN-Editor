(function (SVG, $, CodeMirror, vkbeautify) {
    var bpmnEditor = (function (SVG, $, vkbeautify) {
        var constants = {
            sizes: {
                swl_margin_top: 5,
                swl_margin_left: 5,
                swl_height: 300,
                pool_lblbox_width: 40,
                swl_lblbox_width: 30,
                act_width: 100,
                act_height: 50,
                gateway_width: 40,
                gateway_height: 40,
                emevt_width: 32,
                emevt_height: 32,
                emevt_dx: 4,
                emevt_dy: 4,
                event_width: 41,
                event_height: 42,
                antn_height: 40,
                antn_width: 14,
                antn_line_len: 200,
                dataobj_width: 40,
                dataobj_height: 52,
                dataobj_line_len: 100
            },
            labelpathstring: {},
            attrs: {
                act: {
                    rx: 5,
                    ry: 5,
                    fill: "#fff",
                    stroke: "#000",
                    "stroke-width": 1
                }
            }
        },
            pool,
            swimlanes = [],
            widgets = [],
            links = [],
            canvas,
            parentElem,
            linkable = {
                enable: false,
                start: null,
                end: null,
                style: 0,
                flylink: null,
                down: false,
                canvasmousemove: function (event) {
                    if (event.buttons == 1) {
                        linkable.flylink.end.x = getCursorPos(event).x;
                        linkable.flylink.end.y = getCursorPos(event).y;
                        updateLink(linkable.flylink);
                    }
                },

                canvasmouseup: function () {
                    linkable.end = null;
                    linkable.start = null;
                    linkable.flylink.elem.remove();
                    linkable.flylink = null;
                    linkable.down = false;
                    canvas.off("mousemove", linkable.canvasmousemove);
                    canvas.off("mouseup", linkable.canvasmouseup);
                },

                mouseenter: function () {
                    SVG.get(this.getAttribute("id")).filter(function (add) {
                        add.colorMatrix('matrix', [.343, .669, .119, 0, 0, .249, .626, .130, 0, 0, .172, .334, .111, 0, 0, .000, .000, .000, 1, 0]);
                    });
                },

                mouseleave: function () {
                    SVG.get(this.getAttribute("id")).attr("filter", "");
                },

                mousedown: function (event) {
                    if (event.buttons == 1) {
                        linkable.start = getItemByNode(this);
                        linkable.flylink = initLink(linkable.start, { x: null, y: null }, { style: linkable.style, fly: true });
                        linkable.down = true;
                        canvas.on("mousemove", linkable.canvasmousemove);
                        canvas.on("mouseup", linkable.canvasmouseup); 1
                    }
                },

                mouseup: function (event) {
                    if (!linkable.down) return;
                    event.stopPropagation();
                    linkable.end = getItemByNode(this);
                    if ((linkable.start != linkable.end) && (linkable.start.data.event != linkable.end) && (linkable.end.data.event != linkable.start)) {
                        var lnk = initLink(linkable.start, linkable.end, { style: linkable.style });
                        updateLink(lnk);
                    }
                    linkable.end = null;
                    linkable.start = null;
                    linkable.flylink.elem.remove();
                    linkable.flylink = null;
                    linkable.down = false;
                    canvas.off("mousemove", linkable.canvasmousemove);
                    canvas.off("mouseup", linkable.canvasmouseup);
                }

            },

            contextmenu = {
                enable: function (widget, en) {
                    eventManager(widget, "contextmenu", this.handler, en);
                },

                handler: function (event) {
                    event.preventDefault();
                    var widget = getItemByNode(this);
                    contextmenu.show({
                        "Delete": function () { deletewidget(widget); $(this).parent().remove(); },
                        "Bring on top": function () { bringOntop(widget); $(this).parent().remove(); },
                    }, getCursorPos(event).x, getCursorPos(event).y);
                    return false;
                },

                show: function (items, x, y) {
                    var menu = $("<div></div>")
                        .addClass("contextmenu")
                        .attr("tabindex", 0)
                        .appendTo(parentElem)
                        .css({ top: y, left: x })
                        .focus()
                        .blur(function () {
                            $(this).remove();
                        });
                    for (var item in items) {
                        if (items.hasOwnProperty(item)) {
                            menu.append($("<div></div>")
                                            .addClass("contextmenu-item")
                                            .text(item)
                                            .click(items[item])
                                        );
                        }
                    }
                }
            },

            editlabel = {
                widget: {
                    enable: function (widget, en) {
                        eventManager(widget, "dblclick", this.handler, en);
                    },

                    handler: function (event) {
                        var widget = getItemByNode(this),
                            text = "",
                            path = constants.labelpathstring[widget.wid_type],
                            pos = getAbsPos(widget.elem);

                        if (typeof path == "object") {
                            path = path[widget.wid_id];
                        }
                        if (widget.data.text) {
                            text = widget.data.text.content.trim();
                        }

                        editlabel.show(pos, text, function (text) {
                            if (widget.data.text) {
                                widget.data.text.remove();
                                delete widget.data.text;
                            }
                            if (text != "") {
                                widget.data.text = widget.elem.text(text).font({
                                    family: 'Calibri',
                                    size: 13
                                }).path(path).attr("class", "item-label");
                            }
                        });

                    }
                },

                link: {
                    enable: function (lnk, en) {
                        eventManager(lnk, "click", this.handler, en);
                    },

                    handler: function (event) {
                        var lnk = getItemByNode(this),
                            text = "",
                            path = lnk.elem.attr("d"),
                            pos = getAbsPos(lnk.elem);

                        if (lnk.data.text) {
                            text = lnk.data.text.content.trim();
                        }

                        editlabel.show(pos, text, function (text) {
                            if (lnk.data.text) {
                                lnk.data.text.remove();
                                delete lnk.data.text;
                            }
                            if (text != "") {
                                lnk.data.text = canvas.text(text).font({
                                    family: 'Calibri',
                                    size: 13
                                }).path(path).attr("class", "item-label");
                                lnk.data.text.textPath.attr('startOffset', 10);
                            }
                        });
                    }

                },

                pool: {
                    enable: function (pool, en) {
                        eventManager(pool.lblbox, "dblclick", this.handler, en);
                        if (en === false) {
                            pool.lblbox.elem.attr("class", pool.lblbox.elem.attr("class").replace("pool-labelbox-hover", ""));
                        } else {
                            pool.lblbox.elem.attr("class", pool.lblbox.elem.attr("class") + " pool-labelbox-hover");
                        }
                    },

                    handler: function (event) {
                        var lblbox = pool.lblbox;
                        text = "",
                        pos = getCursorPos(event);

                        if (lblbox.text) {
                            text = lblbox.text.content.trim();
                        }

                        editlabel.show(pos, text, function (text) {
                            if (lblbox.text) {
                                lblbox.text.remove();
                                delete lblbox.text;
                            }
                            if (text != "") {
                                lblbox.text = pool.elem.text(text).font({
                                    family: 'Calibri',
                                    size: 15,
                                    anchor: 'middle'
                                }).path(lblbox.textpath).attr("class", "item-label pool-label");
                                lblbox.text.textPath.attr('startOffset', '50%');
                            }
                        });
                    }
                },

                swimlane: {
                    enable: function (swl, en) {
                        eventManager(swl.lblbox, "dblclick", this.handler, en);
                        if (en === false) {
                            swl.lblbox.elem.attr("class", swl.lblbox.elem.attr("class").replace("swimlane-labelbox-hover", ""));
                        } else {
                            swl.lblbox.elem.attr("class", swl.lblbox.elem.attr("class") + " swimlane-labelbox-hover");
                        }
                    },

                    handler: function (event) {
                        var swl = getItemByNode(this),
                            text = "",
                            pos = getCursorPos(event);

                        if (swl.lblbox.text) {
                            text = swl.lblbox.text.content.trim();
                        }

                        editlabel.show(pos, text, function (text) {
                            if (swl.lblbox.text) {
                                swl.lblbox.text.remove();
                                delete swl.lblbox.text;
                            }
                            if (text != "") {
                                swl.lblbox.text = swl.elem.text(text).font({
                                    family: 'Calibri',
                                    size: 14,
                                    anchor: 'middle'
                                }).path(swl.lblbox.textpath).attr("class", "item-label swimlane-label");
                                swl.lblbox.text.textPath.attr('startOffset', '50%');
                            }
                        });
                    }
                },

                show: function (pos, text, callback) {
                    closePopupWindows();
                    $("<div></div>")
                            .addClass("popup-window")
                            .addClass("textedit")
                            .append($("<textarea></textarea>")
                                .addClass("textbox-label")
                                .val(text))
                            .append($("<div></div>")
                                .addClass("popup-window-footer")
                                .append($("<button></button>")
                                    .addClass("popup-window-button")
                                    .text("Set")
                                    .click(function () {
                                        callback($(this).parent().siblings("textarea").val());
                                        $(this).parent().parent().remove();
                                    }))
                                .append($("<button></button>")
                                    .addClass("popup-window-button")
                                    .text("Cancel")
                                    .click(function () {
                                        $(this).parent().parent().remove();
                                    })))
                            .appendTo(parentElem)
                            .css({ left: pos.x, top: pos.y })
                            .keypress(function (e) {
                                if (e.keyCode == 27)//escape
                                    $(this).remove();
                            })
                            .ready(function () {
                                $(this).find("textarea").focus();
                            });
                }
            },
            widgetsInfo = [
                { type: "activity", id: 1, name: "process", src: "bpmn pic/activity.png" },
                { type: "event", id: 1, name: "StartIntermidiate", src: "bpmn pic/event (1).png" },
                { type: "event", id: 2, name: "Start", src: "bpmn pic/event (2).png" },
                { type: "event", id: 3, name: "End", src: "bpmn pic/event (3).png" },
                { type: "event", id: 4, name: "TimerIntermidiate", src: "bpmn pic/event (4).png" },
                { type: "event", id: 5, name: "TimerStart", src: "bpmn pic/event (5).png" },
                { type: "event", id: 6, name: "Terminate", src: "bpmn pic/event (6).png" },
                { type: "event", id: 7, name: "RuleIntermidiat", src: "bpmn pic/event (7).png" },
                { type: "event", id: 8, name: "RuleStart", src: "bpmn pic/event (8).png" },
                { type: "event", id: 9, name: "MulipleIntermidiate", src: "bpmn pic/event (9).png" },
                { type: "event", id: 10, name: "MultipleStart", src: "bpmn pic/event (10).png" },
                { type: "event", id: 11, name: "MessageEnd", src: "bpmn pic/event (11).png" },
                { type: "event", id: 12, name: "MessageIntermidiate", src: "bpmn pic/event (12).png" },
                { type: "event", id: 13, name: "MessageStart", src: "bpmn pic/event (13).png" },
                { type: "event", id: 14, name: "LinkEnd", src: "bpmn pic/event (14).png" },
                { type: "event", id: 15, name: "LinkIntermidiate", src: "bpmn pic/event (15).png" },
                { type: "event", id: 16, name: "LinkStart", src: "bpmn pic/event (16).png" },
                { type: "event", id: 17, name: "ErrorEnd", src: "bpmn pic/event (17).png" },
                { type: "event", id: 18, name: "ErrorIntermidiate", src: "bpmn pic/event (18).png" },
                { type: "event", id: 19, name: "CompensationEnd", src: "bpmn pic/event (19).png" },
                { type: "event", id: 20, name: "CompensationIntermidiate", src: "bpmn pic/event (20).png" },
                { type: "event", id: 21, name: "CancelEnd", src: "bpmn pic/event (21).png" },
                { type: "gateway", id: 1, name: "AND", src: "bpmn pic/gateway (1).png" },
                { type: "gateway", id: 2, name: "XOR_Event", src: "bpmn pic/gateway (2).png" },
                { type: "gateway", id: 3, name: "XOR_Data", src: "bpmn pic/gateway (3).png" },
                { type: "gateway", id: 4, name: "OR", src: "bpmn pic/gateway (4).png" },
                { type: "gateway", id: 5, name: "Complex", src: "bpmn pic/gateway (5).png" },
                { type: "gateway", id: 6, name: "Decision", src: "bpmn pic/gateway (6).png" },
                { type: "link", id: 1, name: "Default Sequence", src: "bpmn pic/arrow (1).png" },
                { type: "link", id: 2, name: "Conditional Sequence", src: "bpmn pic/arrow (2).png" },
                { type: "link", id: 3, name: "Message", src: "bpmn pic/arrow (3).png" },
                { type: "link", id: 4, name: "Normal Sequence", src: "bpmn pic/arrow (4).png" },
                { type: "link", id: 5, name: "AssociationW", src: "bpmn pic/arrow (5).png" },
                { type: "link", id: 6, name: "Association", src: "bpmn pic/arrow (6).png" },
                { type: "data", id: 1, name: "Annotation", src: "bpmn pic/annotation.png" },
                { type: "data", id: 2, name: "Group", src: "bpmn pic/group.png" },
                { type: "data", id: 3, name: "Data Object", src: "bpmn pic/data object.png" }
            ];

        constants.labelpathstring.activity = (new pathDrawer())
                                                   .M(3, 0).L(constants.sizes.act_width - 3, 0)
                                                   .M(3, 13).L(constants.sizes.act_width - 3, 13)
                                                   .M(3, 27).L(constants.sizes.act_width - 3, 27)
                                                   .toString();
        constants.labelpathstring.data = {
            annotation: (new pathDrawer())
                        .M(constants.sizes.antn_width + 3, -10).l(constants.sizes.antn_line_len, 0)
                        .M(constants.sizes.antn_width, 3).l(constants.sizes.antn_line_len, 0)
                        .M(constants.sizes.antn_width, 16).l(constants.sizes.antn_line_len, 0)
                        .M(constants.sizes.antn_width + 3, 29).l(constants.sizes.antn_line_len, 0)
                        .toString(),
            dataobject: (new pathDrawer())
                        .M(constants.sizes.dataobj_width, -10).l(constants.sizes.dataobj_line_len, 0)
                        .M(constants.sizes.dataobj_width, 3).l(constants.sizes.dataobj_line_len, 0)
                        .M(constants.sizes.dataobj_width, 16).l(constants.sizes.dataobj_line_len, 0)
                        .M(constants.sizes.dataobj_width, 29).l(constants.sizes.dataobj_line_len, 0)
                        .toString()
        };

        function getAbsPos(obj) {
            var pos = { x: 0, y: 0 };
            while (obj.parent) {
                pos.x += obj.x();
                pos.y += obj.y();
                obj = obj.parent;
            }
            return pos;
        };

        function pathDrawer() {
            this.str = "";
            this.M = function (x, y) {
                this.str += "M" + x + "," + y;
                return this;
            }
            this.C = function (cpx1, cpy1, cpx2, cpy2, x, y) {
                this.str += "C" + cpx1 + "," + cpy1 + " " + cpx2 + "," + cpy2 + " " + x + "," + y;
                return this;
            }
            this.Q = function (cpx, cpy, x, y) {
                this.str += "Q" + cpx + "," + cpy + " " + x + "," + y;
                return this;
            }
            this.q = function (cpx, cpy, x, y) {
                this.str += "q" + cpx + "," + cpy + " " + x + "," + y;
                return this;
            }
            this.L = function (x, y) {
                this.str += "L" + x + "," + y;
                return this;
            }
            this.m = function (x, y) {
                this.str += "m" + x + "," + y;
                return this;
            }
            this.c = function (cpx1, cpy1, cpx2, cpy2, x, y) {
                this.str += "c" + cpx1 + "," + cpy1 + " " + cpx2 + "," + cpy2 + " " + x + "," + y;
                return this;
            }
            this.l = function (x, y) {
                this.str += "l" + x + "," + y;
                return this;
            }
            this.toString = function () {
                return this.str;
            }
        };

        function eventManager(item, eventname, handler, en) {
            if (typeof en == "undefined")
                en = true;
            var elem = item.elem,
                i = 0;
            while (elem.type == "g" || elem.type == "text") {
                elem = item.elem.get(i++);
            };
            var elem = item.wid_type ? item.elem.first() : item.elem;
            if (en) {
                elem.on(eventname, handler);
            }
            else {
                elem.off(eventname, handler);
            }
        }

        function getCursorPos(event) {
            return {
                x: event.pageX ,//- $(parentElem).offset().left,
                y: event.pageY //- $(parentElem).offset().top
            };
        };

        function initLink(start, end, data) {
            var strclass = "link link-style-" + data.style + (data.fly ? " link-fly" : ""),
                path = canvas.path("", true).attr("class", strclass),
                lnk = {
                    elem: path,
                    data: data,
                    start: start,
                    end: end
                };
            lnk.data.name = getWidgetInfo("link", parseInt(data.style)).name;
            if (!lnk.data.fly) {
                lnk.data.id = lnk.data.id || id("link");
                editlabel.link.enable(lnk);
                start.link.push(lnk);
                end.link.push(lnk);
                links.push(lnk);
            }
            if (lnk.data.label) {
                lnk.data.text = canvas.text(lnk.data.label).font({
                    family: 'Calibri',
                    size: 13
                }).path("").attr("class", "item-label");
                lnk.data.text.textPath.attr('startOffset', 10);
            }
            return lnk;
        };

        function updateLink(lnk) {
            var points = getpoints(lnk.start, lnk.end, lnk.data.fly);
            var pathstring = (new pathDrawer).M(points.start.x, points.start.y).L(points.end.x, points.end.y).toString();
            lnk.elem.attr("d", pathstring);
            if (lnk.data.text) {
                lnk.data.text.plot(pathstring);
            }
        };

        function getpoints(start, end, fly) {
            var joins = {
                start: new Array(),
                end: new Array()
            };
            var startAbsPos = getAbsPos(start.elem);
            start.join.forEach(function (jn) {
                joins.start.push({ x: startAbsPos.x + jn.x, y: startAbsPos.y + jn.y });
            });
            if (fly) {
                joins.end.push({ x: end.x, y: end.y });
            }
            else {
                var endAbsPos = getAbsPos(end.elem);
                end.join.forEach(function (jn) {
                    joins.end.push({ x: endAbsPos.x + jn.x, y: endAbsPos.y + jn.y });
                });
            }

            var dmin = null,
                msj = null,
                mej = null;

            joins.start.forEach(function (sj) {
                joins.end.forEach(function (ej) {
                    var d = Math.abs(sj.x - ej.x) + Math.abs(sj.y - ej.y);
                    if (dmin == null || d < dmin) {
                        dmin = d;
                        msj = sj;
                        mej = ej;
                    }
                });
            });

            return { start: msj, end: mej };
        }

        function getItemByNode(node) {
            if (node.tagName == "path") {
                var link;
                links.forEach(function (lnk) {
                    if (lnk.elem.node == node)
                        link = lnk;
                });
                return link;
            }
            if (Array.prototype.slice.call(node.classList).indexOf("swimlane-labelbox") > -1) {
                var swimlane;
                swimlanes.forEach(function (swl) {
                    if (swl.lblbox.elem.node == node)
                        swimlane = swl;
                });
                return swimlane;
            }
            node = node.parentNode;
            var widget;
            widgets.forEach(function (wid) {
                if (wid.elem.node == node)
                    widget = wid;
            });
            return widget;
        };

        function deletewidget(widget) {
            if (widget.data.event) {
                deletewidget(widget.data.event);
            }
            for (var i = 0; widget.link.length > 0;) {
                var lnk = widget.link[i];
                lnk.elem.remove();
                if (lnk.data.text) {
                    lnk.data.text.remove();
                }
                lnk.start.link.splice(lnk.start.link.indexOf(lnk), 1);
                lnk.end.link.splice(lnk.end.link.indexOf(lnk), 1);
                links.splice(links.indexOf(lnk), 1);
            }
            widgets.splice(widgets.indexOf(widget), 1);
            widget.elem.remove();
        };

        function bringOntop(widget) {
            widget.elem.front();
        };

        function widgetDraggable(widget, en) {
            if (widget.wid_type == "embededEvent")
                return;
            if (typeof en == "undefined")
                en = true;
            if (en) {
                widget.elem.dragmove = function (delta, event) {
                    closePopupWindows();
                    widget.elem.style({ "cursor": "move" });
                    widget.link.forEach(function (lnk) {
                        updateLink(lnk);
                    });
                    if (widget.data.event) {
                        widget.data.event.link.forEach(function (lnk) {
                            updateLink(lnk);
                        });
                    }
                };
                widget.elem.dragend = function () {
                    widget.elem.style({ "cursor": "inherit" });
                };
                widget.elem.draggable({
                    minX: 0,
                    minY: 0,
                    maxX: widget.elem.parent.bbox().width,
                    maxY: widget.elem.parent.bbox().height
                });
            }
            else {
                widget.elem.fixed();
            }
        };

        function initWidget(widget) {
            switch (widget.wid_type) {
                case "activity":
                    widget.elem.rect(constants.sizes.act_width, constants.sizes.act_height).attr(constants.attrs.act);
                    widget.join.push({ x: 0, y: 0 });
                    widget.join.push({ x: constants.sizes.act_width / 2, y: 0 });
                    widget.join.push({ x: constants.sizes.act_width, y: 0 });
                    widget.join.push({ x: constants.sizes.act_width, y: constants.sizes.act_height / 2 });
                    widget.join.push({ x: constants.sizes.act_width, y: constants.sizes.act_height });
                    widget.join.push({ x: constants.sizes.act_width / 2, y: constants.sizes.act_height });
                    widget.join.push({ x: 0, y: constants.sizes.act_height });
                    widget.join.push({ x: 0, y: constants.sizes.act_height / 2 });
                    break;
                case "gateway":
                    widget.elem.image(widget.data.src, constants.sizes.gateway_width, constants.sizes.gateway_height);
                    widget.join.push({ x: constants.sizes.gateway_width / 2, y: 0 });
                    widget.join.push({ x: constants.sizes.gateway_width / 2, y: constants.sizes.gateway_height });
                    widget.join.push({ x: constants.sizes.gateway_width, y: constants.sizes.gateway_height / 2 });
                    widget.join.push({ x: 0, y: constants.sizes.gateway_height / 2 });
                    break;
                case "event":
                    widget.elem.image(widget.data.src, constants.sizes.event_width, constants.sizes.event_height);
                    widget.join.push({ x: constants.sizes.event_width / 2, y: 0 });
                    widget.join.push({ x: constants.sizes.event_width, y: constants.sizes.event_height / 2 });
                    widget.join.push({ x: constants.sizes.event_width / 2, y: constants.sizes.event_height });
                    widget.join.push({ x: 0, y: constants.sizes.event_height / 2 });
                    break;
                case "embededEvent":
                    widget.elem.image(widget.data.src, constants.sizes.emevt_width, constants.sizes.emevt_height);
                    widget.join.push({ x: constants.sizes.emevt_width, y: constants.sizes.emevt_height / 2 });
                    widget.join.push({ x: constants.sizes.emevt_width / 2, y: constants.sizes.emevt_height });
                    break;
                case "data":
                    switch (widget.wid_id) {
                        case "1":
                            widget.elem.image(widget.data.src, constants.sizes.antn_width, constants.sizes.antn_height);
                            widget.join.push({ x: 0, y: constants.sizes.antn_height / 2 });
                            break;
                        case "3":
                            widget.elem.image(widget.data.src, constants.sizes.dataobj_width, constants.sizes.dataobj_height);
                            widget.join.push({ x: 0, y: 0 });
                            widget.join.push({ x: constants.sizes.dataobj_width, y: constants.sizes.dataobj_height / 2 });
                            widget.join.push({ x: constants.sizes.dataobj_width, y: constants.sizes.dataobj_height });
                            widget.join.push({ x: constants.sizes.dataobj_width / 2, y: constants.sizes.dataobj_height });
                            widget.join.push({ x: 0, y: constants.sizes.dataobj_height });
                            widget.join.push({ x: 0, y: constants.sizes.dataobj_height / 2 });
                            break;
                    }
                    break;
            }
        };

        function addEvent(widget, wid_type, wid_id, data) {
            var actW = constants.sizes.act_width,
                actH = constants.sizes.act_height,
                evtW = constants.sizes.emevt_width,
                evtH = constants.sizes.emevt_height,
                etDx = constants.sizes.emevt_dx,
                etDy = constants.sizes.emevt_dy;
            widget.data.event = addWidget(actW - evtW / 2 - etDx, actH - evtH / 2 - etDy, widget, "embededEvent", wid_id, data);
        };

        function addWidget(x, y, parent, wid_type, wid_id, data) {
            var widget = {
                wid_type: wid_type,
                wid_id: wid_id,
                elem: parent.elem.group(),
                data: data,
                join: [],
                link: []
            };
            widget.data.id = widget.data.id || id(widget.wid_type);
            initWidget(widget);
            widget.elem.move(x, y);
            widgetDraggable(widget);
            contextmenu.enable(widget);
            if (widget.wid_type == "activity" || widget.wid_type == "data")
                editlabel.widget.enable(widget);
            if (widget.data.label) {
                var path = constants.labelpathstring[widget.wid_type];
                if (typeof path == "object") {
                    path = path[widget.wid_id];
                }
                widget.data.text = widget.elem.text(widget.data.label).font({
                    family: 'Calibri',
                    size: 13
                }).path(path).attr("class", "item-label");
            }
            widgets.push(widget);
            return widget;
        };

        function closePopupWindows() {
            $(".popup-window").remove();
        };

        function reset() {
            canvas.clear();
            id.reset();
            widgets.splice(0, widgets.length);
            links.splice(0, links.length);
            swimlanes.splice(0, swimlanes.length);
            pool = null;
        };

        function id(name) {
            var newid = name.charAt(0).toUpperCase() + (id.val++);
            if (id.reserved.indexOf(newid) == -1) {
                return newid;
            } else {
                return id(name);
            }
        };
        id.val = 0;
        id.reserved = [];
        id.add = function (str) {
            if (id.reserved.indexOf(str) == -1) {
                id.reserved.push(str);
            }
        };
        id.reset = function () {
            id.val = 0;
            id.reserved.splice(0, id.reserved.length);
        };

        function showerrors(msgs) {

        };

        function getSwimlaneById(id) {
            var retVal = null;
            for (var i = 0; i < swimlanes.length; i++) {
                if (swimlanes[i].data.id == id) {
                    retVal = swimlanes[i];
                    break;
                }
            }
            return retVal;
        };

        function getWidgetInfo(type, param) {
            var info;
            if (typeof param == "number") {
                for (var i in widgetsInfo) {
                    if (widgetsInfo[i].type.toLowerCase() == type.toLowerCase() && widgetsInfo[i].id == param) {
                        info = widgetsInfo[i];
                        break;
                    }
                }
            } else if (typeof param == "string") {
                for (var i in widgetsInfo) {
                    if (widgetsInfo[i].type.toLowerCase() == type.toLowerCase() && widgetsInfo[i].name.toLowerCase() == param.toLowerCase()) {
                        info = widgetsInfo[i];
                        break;
                    }
                }
            }
            return info;
        };

        function getWidgetById(id) {
            var widget;
            widgets.forEach(function (wid) {
                if (wid.data.id == id)
                    widget = wid;
            });
            return widget;
        };

        function initMarkers() {
            var defs = canvas.defs().node;
            var marker = SVG.document.createElementNS(SVG.ns, "marker");
            marker.setAttribute("markerWidth", "10");
            marker.setAttribute("markerHeight", "10");
            marker.setAttribute("id", "mkr-circle");
            marker.setAttribute("orient", "auto");
            marker.setAttribute("stroke", "black");
            marker.setAttribute("fill", "#fff");
            marker.setAttribute("refX", "5");
            marker.setAttribute("refY", "5");
            var mkrContent = SVG.document.createElementNS(SVG.ns, "circle");
            mkrContent.setAttribute("cx", "5");
            mkrContent.setAttribute("cy", "5");
            mkrContent.setAttribute("r", "3");
            marker.appendChild(mkrContent);

            defs.appendChild(marker);

            var marker = SVG.document.createElementNS(SVG.ns, "marker");
            marker.setAttribute("markerWidth", "10");
            marker.setAttribute("markerHeight", "10");
            marker.setAttribute("id", "mkr-triangle-white");
            marker.setAttribute("orient", "auto");
            marker.setAttribute("stroke", "black");
            marker.setAttribute("fill", "#fff");
            marker.setAttribute("refX", "8");
            marker.setAttribute("refY", "4");
            var mkrContent = SVG.document.createElementNS(SVG.ns, "path");
            mkrContent.setAttribute("d", "M0,0L8,4L0,8Z");
            marker.appendChild(mkrContent);

            defs.appendChild(marker);

            var marker = SVG.document.createElementNS(SVG.ns, "marker");
            marker.setAttribute("markerWidth", "10");
            marker.setAttribute("markerHeight", "10");
            marker.setAttribute("id", "mkr-triangle-black");
            marker.setAttribute("orient", "auto");
            marker.setAttribute("stroke", "black");
            marker.setAttribute("fill", "#000");
            marker.setAttribute("refX", "8");
            marker.setAttribute("refY", "4");
            var mkrContent = SVG.document.createElementNS(SVG.ns, "path");
            mkrContent.setAttribute("d", "M0,0L8,4L0,8Z");
            marker.appendChild(mkrContent);

            defs.appendChild(marker);

            var marker = SVG.document.createElementNS(SVG.ns, "marker");
            marker.setAttribute("markerWidth", "10");
            marker.setAttribute("markerHeight", "10");
            marker.setAttribute("id", "mkr-kite");
            marker.setAttribute("orient", "auto");
            marker.setAttribute("stroke", "black");
            marker.setAttribute("fill", "#fff");
            marker.setAttribute("refX", "4");
            marker.setAttribute("refY", "2");
            var mkrContent = SVG.document.createElementNS(SVG.ns, "path");
            mkrContent.setAttribute("d", "M0,2L4,0L8,2L4,4Z");
            marker.appendChild(mkrContent);

            defs.appendChild(marker);

            var marker = SVG.document.createElementNS(SVG.ns, "marker");
            marker.setAttribute("markerWidth", "10");
            marker.setAttribute("markerHeight", "10");
            marker.setAttribute("id", "mkr-arrow");
            marker.setAttribute("orient", "auto");
            marker.setAttribute("stroke", "black");
            marker.setAttribute("fill", "#fff");
            marker.setAttribute("refX", "4");
            marker.setAttribute("refY", "2");
            var mkrContent = SVG.document.createElementNS(SVG.ns, "path");
            mkrContent.setAttribute("d", "M0,0L4,2L0,4");
            marker.appendChild(mkrContent);

            defs.appendChild(marker);
        };

        return {
            init: function (parent) {
                canvas = SVG(parent).size("100%", "100%");
                initMarkers();
                parentElem = document.getElementById(parent);
            },

            setSwimlane: function (num, infoArray, poolInfo) {
                reset();
                var height = constants.sizes.swl_height * num,
                    group = canvas.group(),
                    pathstr = (new pathDrawer()).M(constants.sizes.swl_margin_left + constants.sizes.pool_lblbox_width / 5, constants.sizes.swl_margin_top + height).l(0, -height).toString(),
                    lblbox = group.rect(constants.sizes.pool_lblbox_width, height).attr({ "class": "pool-labelbox", rx: 2, ry: 2 }).move(constants.sizes.swl_margin_left, constants.sizes.swl_margin_top)
                pool = {
                    elem: group,
                    lblbox: {
                        elem: lblbox,
                        textpath: pathstr,
                    },
                    data: {}
                };

                editlabel.pool.enable(pool);
                if (typeof poolInfo == "object") {
                    pool.data.id = poolInfo.id;
                    if (poolInfo.name) {
                        pool.lblbox.text = pool.elem.text(poolInfo.name).font({
                            family: 'Calibri',
                            size: 15,
                            anchor: 'middle'
                        }).path(pool.lblbox.textpath).attr("class", "item-label pool-label");
                        pool.lblbox.text.textPath.attr('startOffset', '50%');
                    }
                }
                pool.data.id = pool.data.id || id("pool");

                for (; num > 0 ;) {
                    var swl = group.group(),
                        swl_canvas = swl.rect("100%", constants.sizes.swl_height).attr({ "class": "swimlane" });
                    lblbox = swl.rect(constants.sizes.swl_lblbox_width, constants.sizes.swl_height).attr({ "class": "swimlane-labelbox" });
                    pathstr = (new pathDrawer()).M(constants.sizes.swl_lblbox_width / 6, constants.sizes.swl_height).l(0, -constants.sizes.swl_height).toString();
                    swl.move(constants.sizes.swl_margin_left + constants.sizes.pool_lblbox_width, (num - 1) * constants.sizes.swl_height + constants.sizes.swl_margin_top);
                    var swimlane = {
                        canvas: swl_canvas,
                        lblbox: {
                            elem: lblbox,
                            textpath: pathstr
                        },
                        elem: swl,
                        data: {}
                    };
                    if (Array.isArray(infoArray)) {
                        swimlane.data.id = infoArray[num - 1].id;
                        if (infoArray[num - 1].name) {
                            swimlane.lblbox.text = swimlane.elem.text(infoArray[num - 1].name).font({
                                family: 'Calibri',
                                size: 14,
                                anchor: 'middle'
                            }).path(swimlane.lblbox.textpath).attr("class", "item-label swimlane-label");
                            swimlane.lblbox.text.textPath.attr('startOffset', '50%');
                        }
                    }
                    swimlane.data.id = swimlane.data.id || id("swimlane");
                    editlabel.swimlane.enable(swimlane);
                    swimlanes.push(swimlane);
                    num--;
                }
            },

            swimlaneDroppable: function (en) {
                if (en) {
                    closePopupWindows();
                    swimlanes.forEach(function (swl) {
                        var swlPos = getAbsPos(swl.canvas);
                        $("<div></div>")
                            .addClass("widget-mask")
                            
                            .addClass("widget-mask-swimlane")
                            .css({ width: swl.canvas.bbox().width, height: swl.canvas.bbox().height })
                            .css({ top: swlPos.y, left: swlPos.x })
                            .appendTo(parentElem)
                            .droppable({
                                scope: "widget",
                                tolerance: "fit",
                                accept: "img.bpmn-widget",
                                drop: function (event, ui) {
                                    if (!$(this).hasClass("widget-highlight")) return;
                                    var relY = ui.offset.top - $(this).offset().top;
                                    var relX = ui.offset.left - $(this).offset().left;
                                    relX = relX < 0 ? 0 : relX;
                                    relY = relY < 0 ? 0 : relY;
                                    var wid_type = ui.draggable.attr("data-widget-type");
                                    var wid_id = ui.draggable.attr("data-widget-id");
                                    var data = {
                                        src: ui.draggable.attr("src"),
                                        swimlane: swl,
                                        name: ui.draggable.attr("data-widget-name") || ""
                                    };
                                    addWidget(relX, relY, swl, wid_type, wid_id, data);
                                },
                                over: function () {
                                    $(this).addClass("widget-highlight");
                                },
                                out: function () {
                                    $(this).removeClass("widget-highlight");
                                }
                            });
                    });
                }
                else {
                    $("div.widget-mask").remove();
                }
            },

            swimActDroppable: function (en) {
                if (en) {
                    this.swimlaneDroppable(true);
                    widgets.forEach(function (widget) {
                        if (widget.wid_type == "activity") {
                            var pos = getAbsPos(widget.elem);
                            var parSwl;
                            $("<div></div>")
                                .addClass("widget-mask")
                                .css({ width: widget.elem.bbox().width, height: widget.elem.bbox().height })
                                .css({ top: pos.y, left: pos.x })
                                .appendTo(parentElem)
                                .droppable({
                                    scope: "widget",
                                    accept: "img.bpmn-widget",
                                    drop: function (event, ui) {
                                        var wid_type = ui.draggable.attr("data-widget-type");
                                        var wid_id = ui.draggable.attr("data-widget-id");
                                        var data = {
                                            src: ui.draggable.attr("src"),
                                            swimlane: widget.data.swimlane,
                                            parent: widget,
                                            name: ui.draggable.attr("data-widget-name") || ""
                                        };
                                        addEvent(widget, wid_type, wid_id, data);
                                    },
                                    over: function () {
                                        parSwl = $(this).siblings(".widget-mask-swimlane.widget-highlight").removeClass("widget-highlight");
                                        $(this).addClass("widget-highlight");
                                    },
                                    out: function () {
                                        $(this).removeClass("widget-highlight");
                                        parSwl.addClass("widget-highlight");
                                    }
                                });
                        }
                    })
                }
                else {
                    $("div.widget-mask").remove();
                }
            },

            linkable: function (en, style) {
                if (en) {
                    linkable.style = style;
                    if (linkable.enable) {
                        return;
                    }
                    closePopupWindows();
                    swimlanes.forEach(function (swl) {
                        swl.elem.style("cursor", "crosshair");
                        editlabel.swimlane.enable(swl, false);
                    });
                    widgets.forEach(function (widget) {
                        widgetDraggable(widget, false);
                        contextmenu.enable(widget, false);
                        editlabel.widget.enable(widget, false);
                        eventManager(widget, "mouseenter", linkable.mouseenter);
                        eventManager(widget, "mouseleave", linkable.mouseleave);
                        eventManager(widget, "mousedown", linkable.mousedown);
                        eventManager(widget, "mouseup", linkable.mouseup);
                    });
                    if (pool) {
                        editlabel.pool.enable(pool, false);
                    }
                    linkable.enable = true;
                }
                else {
                    if (!linkable.enable) {
                        return;
                    }
                    swimlanes.forEach(function (swl) {
                        swl.elem.style("cursor", "auto");
                        editlabel.swimlane.enable(swl);
                    });
                    widgets.forEach(function (widget) {
                        widgetDraggable(widget);
                        contextmenu.enable(widget);
                        editlabel.widget.enable(widget);
                        eventManager(widget, "mouseenter", linkable.mouseenter, false);
                        eventManager(widget, "mouseleave", linkable.mouseleave, false);
                        eventManager(widget, "mousedown", linkable.mousedown, false);
                        eventManager(widget, "mouseup", linkable.mouseup, false);
                    });
                    if (pool) {
                        editlabel.pool.enable(pool);
                    }
                    linkable.enable = false;
                }
            },

            poolselected: function () {
                return (typeof pool != "undefined") && (pool !== null);
            },

            toXPDL: function () {
                if (!this.poolselected()) {
                    return "";
                }

                var error = {
                    messages: []
                };

                var activities = "";

                widgets.forEach(function (widget) {
                    switch (widget.wid_type) {
                        case "activity":

                            if (widget.data.event)
                                break;

                            var numIn = 0,
                                numOut = 0;

                            widget.link.forEach(function (lnk) {
                                if (lnk.start == widget)
                                    numOut++;
                                else
                                    numIn++;
                            });
                            if (numIn == numOut) {
                                if (numIn > 1) {
                                    error.messages.push("invalid activity found");
                                    break;
                                }
                                activities
                                   += '<Activity Id="' + widget.data.id + '" Name="' + (widget.data.text ? widget.data.text.content.trim() : "") + '">'
                                    + '<Implementation>'
                                    + '<No/>'
                                    + '</Implementation>'
                                    + '<Performers>'
                                    + '<Performer>' + (widget.data.swimlane.lblbox.text ? widget.data.swimlane.lblbox.text.content.trim() : "") + '</Performer>'
                                    + '</Performers>'
                                    + '<NodeGraphicsInfos>'
                                    + '<NodeGraphicsInfo BorderColor="0,0,0" FillColor="255,255,255" Height="' + constants.sizes.act_height + '" Width="' + constants.sizes.act_width + '" LaneId="' + widget.data.swimlane.data.id + '">'
                                    + '<Coordinates XCoordinate="' + widget.elem.x() + '" YCoordinate="' + widget.elem.y() + '"/>'
                                    + '</NodeGraphicsInfo>'
                                    + '</NodeGraphicsInfos>'
                                    + '</Activity>';
                            }
                            if (numIn > numOut) {
                                activities
                                   += '<Activity Id="' + widget.data.id + '" Name="' + (widget.data.text ? widget.data.text.content.trim() : "") + '">'
                                    + '<Implementation>'
                                    + '<No/>'
                                    + '</Implementation>'
                                    + '<TransitionRestriction>'
                                    + '<Join Type="AND">'
                                    + '<TransitionRefs>';

                                widget.link.forEach(function (lnk) {
                                    if (lnk.end === widget) {
                                        activities += '<TransitionRef id="' + lnk.data.id + '"/>';
                                    }
                                });

                                activities
                                   += '</TransitionRefs>'
                                    + '</Join>'
                                    + '</TransitionRestriction>'
                                    + '<Performers>'
                                    + '<Performer>' + (widget.data.swimlane.lblbox.text ? widget.data.swimlane.lblbox.text.content.trim() : "") + '</Performer>'
                                    + '</Performers>'
                                    + '<NodeGraphicsInfos>'
                                    + '<NodeGraphicsInfo BorderColor="0,0,0" FillColor="255,255,255" Height="' + constants.sizes.act_height + '" Width="' + constants.sizes.act_width + '" LaneId="' + widget.data.swimlane.data.id + '">'
                                    + '<Coordinates XCoordinate="' + widget.elem.x() + '" YCoordinate="' + widget.elem.y() + '"/>'
                                    + '</NodeGraphicsInfo>'
                                    + '</NodeGraphicsInfos>'
                                    + '</Activity>';
                            }
                            if (numIn < numOut) {
                                activities
                                   += '<Activity Id="' + widget.data.id + '" Name="' + (widget.data.text ? widget.data.text.content.trim() : "") + '">'
                                    + '<Implementation>'
                                    + '<No/>'
                                    + '</Implementation>'
                                    + '<TransitionRestriction>'
                                    + '<Split Type="AND">'
                                    + '<TransitionRefs>';

                                widget.link.forEach(function (lnk) {
                                    if (lnk.start === widget) {
                                        activities += '<TransitionRef id="' + lnk.data.id + '"/>';
                                    }
                                });

                                activities
                                   += '</TransitionRefs>'
                                    + '</Split>'
                                    + '</TransitionRestriction>'
                                    + '<Performers>'
                                    + '<Performer>' + (widget.data.swimlane.lblbox.text ? widget.data.swimlane.lblbox.text.content.trim() : "") + '</Performer>'
                                    + '</Performers>'
                                    + '<NodeGraphicsInfos>'
                                    + '<NodeGraphicsInfo BorderColor="0,0,0" FillColor="255,255,255" Height="' + constants.sizes.act_height + '" Width="' + constants.sizes.act_width + '" LaneId="' + widget.data.swimlane.data.id + '">'
                                    + '<Coordinates XCoordinate="' + widget.elem.x() + '" YCoordinate="' + widget.elem.y() + '"/>'
                                    + '</NodeGraphicsInfo>'
                                    + '</NodeGraphicsInfos>'
                                    + '</Activity>';
                            }
                            break;
                        case "event":
                            activities
                                  += '<Activity Id="' + widget.data.id + '">'
                                   + '<Event>'
                                   + '<XPDL:' + widget.data.name + ' Trigger="None"/>'
                                   + '</Event>'
                                   + '<NodeGraphicsInfos>'
                                   + '<NodeGraphicsInfo BorderColor="0,0,0" FillColor="255,255,255" Height="' + constants.sizes.event_height + '" Width="' + constants.sizes.event_width + '" LaneId="' + widget.data.swimlane.data.id + '">'
                                   + '<Coordinates XCoordinate="' + widget.elem.x() + '" YCoordinate="' + widget.elem.y() + '"/>'
                                   + '</NodeGraphicsInfo>'
                                   + '</NodeGraphicsInfos>'
                                   + '</Activity>';
                            break;
                        case "gateway":
                            var numIn = 0,
                                numOut = 0;

                            widget.link.forEach(function (lnk) {
                                if (lnk.start === widget) {
                                    numOut++;
                                }
                                else {
                                    numIn++;
                                }
                            });

                            if (numIn == numOut) {
                                error.messages.push("inavlid gateway found");
                            }

                            if (numIn > numOut) {
                                activities
                                  += '<Activity Id="' + widget.data.id + '">'
                                   + '<Route GatewayType="' + widget.data.name + '"/>'
                                   + '<TransitionRestrictions>'
                                   + '<TransitionRestriction>'
                                   + '<Join Type="' + widget.data.name + '">'
                                   + '<TransitionRefs>';

                                widget.link.forEach(function (lnk) {
                                    if (lnk.end === widget) {
                                        activities += '<TransitionRef id="' + lnk.data.id + '"/>';
                                    }
                                });

                                activities
                                  += '</TransitionRefs>'
                                   + '</Join>'
                                   + '</TransitionRestriction>'
                                   + '</TransitionRestrictions>'
                                   + '<NodeGraphicsInfos>'
                                   + '<NodeGraphicsInfo BorderColor="0,0,0" FillColor="255,255,255" Height="' + constants.sizes.gateway_height + '" Width="' + constants.sizes.gateway_width + '" LaneId="' + widget.data.swimlane.data.id + '">'
                                   + '<Coordinates XCoordinate="' + widget.elem.x() + '" YCoordinate="' + widget.elem.y() + '"/>'
                                   + '</NodeGraphicsInfo>'
                                   + '</NodeGraphicsInfos>'
                                   + '</Activity>';
                            }

                            if (numIn < numOut) {
                                activities
                                  += '<Activity Id="' + widget.data.id + '">'
                                   + '<Route GatewayType="' + widget.data.name + '"/>'
                                   + '<TransitionRestrictions>'
                                   + '<TransitionRestriction>'
                                   + '<Split Type="' + widget.data.name + '">'
                                   + '<TransitionRefs>';

                                widget.link.forEach(function (lnk) {
                                    if (lnk.start === widget) {
                                        activities += '<TransitionRef id="' + lnk.data.id + '"/>';
                                    }
                                });

                                activities
                                   += '</TransitionRefs>'
                                   + '</Split>'
                                   + '</TransitionRestriction>'
                                   + '</TransitionRestrictions>'
                                   + '<NodeGraphicsInfos>'
                                   + '<NodeGraphicsInfo BorderColor="0,0,0" FillColor="255,255,255" Height="' + constants.sizes.gateway_height + '" Width="' + constants.sizes.gateway_width + '" LaneId="' + widget.data.swimlane.data.id + '">'
                                   + '<Coordinates XCoordinate="' + widget.elem.x() + '" YCoordinate="' + widget.elem.y() + '"/>'
                                   + '</NodeGraphicsInfo>'
                                   + '</NodeGraphicsInfos>'
                                   + '</Activity>';
                            }
                            break;
                        case "embededEvent":
                            activities
                                  += '<Activity Id="' + widget.data.parent.data.id + '" Name="' + (widget.data.parent.data.text ? widget.data.parent.data.text.content.trim() : "") + '">'
                                   + '<Implementation>'
                                   + '<No/>'
                                   + '</Implementation>'
                                   + '<TransitionRestriction>'
                                   + '<Split Type="XOR">'
                                   + '<TransitionRefs>';

                            widget.link.forEach(function (lnk) {
                                if (lnk.start === widget) {
                                    activities += '<TransitionRef id="' + lnk.data.id + '"/>';
                                }
                            });

                            widget.data.parent.link.forEach(function (lnk) {
                                if (lnk.start === widget) {
                                    activities += '<TransitionRef id="' + lnk.data.id + '"/>';
                                }
                            });

                            activities
                               += '</TransitionRefs>'
                                + '</Split>'
                                + '</TransitionRestriction>'
                                + '<Performers>'
                                + '<Performer>' + (widget.data.swimlane.lblbox.text ? widget.data.swimlane.lblbox.text.content.trim() : "") + '</Performer>'
                                + '</Performers>'
                                + '<NodeGraphicsInfos>'
                                + '<NodeGraphicsInfo BorderColor="0,0,0" FillColor="255,255,255" Height="' + constants.sizes.act_height + '" Width="' + constants.sizes.act_width + '" LaneId="' + widget.data.swimlane.data.id + '">'
                                + '<Coordinates XCoordinate="' + widget.elem.x() + '" YCoordinate="' + widget.elem.y() + '"/>'
                                + '</NodeGraphicsInfo>'
                                + '</NodeGraphicsInfos>'
                                + '</Activity>';
                            break;
                    }
                });

                var transitions = "";

                links.forEach(function (lnk) {
                    transitions
                        += '<Transition Name="' + (lnk.data.text ? lnk.data.text.content.trim() : "") + '" From="' + (lnk.start.wid_type == "embededEvent" ? lnk.start.data.parent.data.id : lnk.start.data.id) + '" Id="' + lnk.data.id + '" To="' + lnk.end.data.id + '">'
                         + '<Condition Type="' + (lnk.start.wid_type == "embededEvent" ? lnk.start.data.name : lnk.data.name) + '"/>'
                         + '<ConnectorGraphicsInfos>'
                         + '<ConnectorGraphicsInfo FillColor="0,0,0" Style="No_Routing_Splines"/>'
                         + '</ConnectorGraphicsInfos>'
                         + '</Transition>';
                });

                var str
                    = '<XPDL:WorkflowProcess Id="' + pool.data.id + '" Name="' + (pool.lblbox.text ? pool.lblbox.text.content.trim() : "") + '" AccessLevel="public">'
                    + '<ProcessHeader>'
                    + '<Created>'
                    + (new Date()).toString()
                    + '</Created>'
                    + '<Description>'
                    + 'Place your description here'
                    + '</Description>'
                    + '</ProcessHeader>'
                    + '<Activities>'
                    + activities
                    + '</Activities>'
                    + '<Transitions>'
                    + transitions
                    + '</Transitions>'
                    + '</XPDL:WorkflowProcess>';

                if (error.messages.length)
                    str = error.messages.join("\n");
                else
                    str = vkbeautify.xml(str);

                return str;
            },

            importXPDL: function (str) {
                str = vkbeautify.xmlmin(str);
                var error = {
                    messages: []
                };

                while ((str = str.replace(":", "_")) && (str.indexOf(":") > -1));

                var root = $("<ROOT>" + str + "</ROOT>");

                if (!root.find("XPDL_WorkflowProcess").length) {
                    error.messages.push("XPDL:WorkflowProcess node not found");
                    showerrors(error.messages);
                    return false;
                }

                var swl_ids = [];
                root.find("NodeGraphicsInfo[LaneId]").each(function () {
                    var laneid;
                    if ((laneid = $(this).attr("LaneId")) && (swl_ids.indexOf(laneid) == -1)) {
                        swl_ids.push(laneid);
                        id.add(laneid);
                    }
                });

                if (swl_ids.length > 4) {
                    error.messages.push("Number of lanes exceeded");
                    showerrors(error.messages);
                    return false;
                }

                var poolInfo = {
                    id: root.find("XPDL_WorkflowProcess").attr("Id"),
                    name: root.find("XPDL_WorkflowProcess").attr("Name")
                };

                if (poolInfo.id) {
                    id.add(poolInfo.id);
                }

                var infoArray = [];
                root.find("Activities Activity").each(function () {
                    if (!($(this).find("Event").length || $(this).find("Route").length)) {
                        var id = $(this).find("NodeGraphicsInfo").attr("LaneId");
                        var name = $(this).find("Performer").html().trim();
                        if (id && name && (swl_ids.indexOf(id) > -1)) {
                            infoArray.push({
                                id: id,
                                name: name
                            });
                            swl_ids.splice(swl_ids.indexOf(id), 1);
                        }
                    }
                });

                swl_ids.forEach(function (id) {
                    infoArray.push({
                        id: id,
                        name: ""
                    });
                });
                this.setSwimlane(infoArray.length, infoArray, poolInfo);

                root.find("Activities Activity").each(function () {
                    var wid = $(this).attr("Id"),
                        label = $(this).attr("Name"),
                        swl_id = $(this).find("NodeGraphicsInfo").attr("LaneId"),
                        x = parseFloat($(this).find("Coordinates").attr("XCoordinate")),
                        y = parseFloat($(this).find("Coordinates").attr("YCoordinate")),
                        parentSwl = getSwimlaneById(swl_id),
                        data = {
                            id: wid,
                            label: label,
                            swimlane: parentSwl
                        };
                    if (wid) {
                        id.add(wid);
                    }
                    if ($(this).find("Event").length) {
                        var eventName = $(this).find("Event").children()[0].nodeName.slice(5),
                            info = getWidgetInfo("event", eventName);
                        data.src = info.src;
                        addWidget(x, y, parentSwl, "event", info.id, data);
                    } else if ($(this).find("Route").length) {
                        var gatewayName = $(this).find("Route").attr("GatewayType"),
                            info = getWidgetInfo("gateway", gatewayName);
                        data.src = info.src;
                        addWidget(x, y, parentSwl, "gateway", info.id, data);
                    } else {
                        var info = getWidgetInfo("activity", "process");
                        data.src = info.src;
                        addWidget(x, y, parentSwl, "activity", info.id, data);
                    }
                });

                root.find("Transitions Transition").each(function () {
                    var lnkId = $(this).attr("Id"),
                        label = $(this).attr("Name"),
                        from = $(this).attr("From"),
                        to = $(this).attr("To"),
                        type = $(this).find("Condition").attr("Type"),
                        widStart = getWidgetById(from),
                        widEnd = getWidgetById(to),
                        linkInfo = getWidgetInfo("link", type);

                    if (typeof linkInfo == "undefined") {
                        var embededEventInfo = getWidgetInfo("event", type);
                        addEvent(widStart, null, embededEventInfo.id, { src: embededEventInfo.src });
                        var lnk = initLink(widStart.data.event, widEnd, { style: 4, id: lnkId, label: label});
                        updateLink(lnk);
                    } else {
                        var lnk = initLink(widStart, widEnd, { style: linkInfo.id, id: lnkId, label: label });
                        updateLink(lnk);
                    }

                });
                return true;
            }
        }
    })(SVG, $, vkbeautify),
        canvasDocument,
        elem,
        container,
        textCSS = '';


    $(function () {

        $(".widgetbox-content td[title]").each(function () {
            $(this).hover(function () {
                $("<div></div>")
                    .addClass("ab-tooltip")
                    .text($(this).attr("title"))
                    .css({ top: $(this).offset().top + $(this).height() / 2, left: $(this).offset().left + $(this).width() })
                    .appendTo(document.body)
                    .append("<div></div>")
                    .children(":last")
                    .addClass("ab-tooltip-arrow");
                $(this).attr("title", "");
            }, function () {
                $(this).attr("title", $("div.ab-tooltip").text());
                $("div.ab-tooltip").remove();
            });
        });
        
        $("<iframe>")
            .attr({ id: 'canvas-frame', src: '' })
            .appendTo("div#canvas");
        elem = document.getElementById('canvas-frame');
        SVG.window = elem.contentWindow;
        canvasDocument = SVG.document = elem.contentDocument || elem.contentWindow.document;
        canvasDocument.open();
        canvasDocument.write('<!DOCTYPE html>');
        canvasDocument.close();

        textCSS = 'html {'
                + 'height:100%;'
            + '}';

        textCSS += 'body {'
                + 'margin:0;'
                + 'height:100%;'
            + '}';

        textCSS += 'div.xpdleditor-canvas {'
              +      'width:100%;'
              +      'height:100%;'
              +      'border-radius:5px;'
              +      'background:url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAOklEQVQ4je3PMQoAMAwCwPz/q+5xCvYLBjq0oOAmBxYgOW2OtStAKiPNsXYBAz4BNkc3+8HlgAH34AGSYSYzwWQ+CQAAAABJRU5ErkJggg==") repeat;'
              +      'background-color:white;'
              +      'overflow:hidden;'
              +      'position:relative;'
              + '}';

        textCSS += '.swimlane {'
                        + 'fill: yellow;'
                        + 'fill-opacity: 0;'
                        + 'stroke-width:3;'
                        + 'stroke:#000;'
                    + '}';

        textCSS += '.swimlane-labelbox {'
                        + 'fill: #dfdfdf;'
                        + 'stroke:#000;'
                        + 'fill-opacity:0;'
                        + 'stroke-width:0;'
                    + '}';

        textCSS += '.swimlane-labelbox:not(.swimlane-labelbox-hover) {'
                        + 'pointer-events:none;   '
                    + '}';
        textCSS += '.swimlane-labelbox-hover:hover {'
                        + 'fill-opacity:0.2;'
                    + '}';
        textCSS += '.pool-labelbox {'
                        + 'fill: #dfdfdf;'
                        + 'stroke:#000;'
                        + 'fill-opacity:0.2;'
                        + 'stroke-width:3;'
                    + '}';
        textCSS += '.pool-labelbox-hover:hover {'
                        + 'fill-opacity:0.5;'
                    + '}';
        textCSS += '.item-label {'
                        + 'pointer-events:none;'
                    + '}';

        textCSS += '.link-fly {'
                        + 'pointer-events:none;'
                    + '}';
        textCSS += '.link:not(.link-fly) {'
                        + 'pointer-events:all;'
                        + 'cursor:pointer;'
                    + '}';
        textCSS += '.link:not(.link-fly):hover {'
                        + 'stroke-width:3;'
                    + '}';
        textCSS += '.link {'
                        + 'stroke:black;'
                        + 'stroke-width:2;'
                        + 'stroke-linejoin:round;'
                        + 'stroke-linecap:round;'
                    + '}';
        textCSS += '.link-style-1 {'
                        + 'marker-end:url(#mkr-triangle-black);'
                        + 'marker-start:none;'
                        + 'marker-mid:none;'
                    + '}'
                        + '.link-style-2 {'
                         + 'marker-end:url(#mkr-triangle-black);'
                          + 'marker-start:url(main.html#mkr-kite);'
                           + 'marker-mid:none;'
                        + '}'
                        + '.link-style-3 {'
                         + 'marker-start:url(#mkr-circle);'
                          + 'marker-end:url(main.html#mkr-triangle-white);'
                         + 'marker-mid:none;'
                          + 'stroke-dasharray:4,5;'
                        + '}'
                        + '.link-style-4 {'
                         + 'marker-end:url(#mkr-triangle-black);'
                          + 'marker-start:none;'
                          + 'marker-mid:none;'
                        + '}'
                        + '.link-style-5 {'
                         + 'marker-end:url(#mkr-arrow);'
                          + 'marker-start:none;'
                          + 'marker-mid:none;'
                         + 'stroke-dasharray:10,5;'
                        + '}'
                        + '.link-style-6 {'
                            + 'marker-end:none;'
                           + 'marker-start:none;'
                          + 'marker-mid:none;'
                         + 'stroke-dasharray:10,5;'
                        + '}';


        elem = canvasDocument.createElement('style');
        elem.appendChild(canvasDocument.createTextNode(textCSS));
        canvasDocument.head.appendChild(elem);

        container = canvasDocument.createElement('div');
        container.setAttribute('class', 'xpdleditor-canvas');
        container.setAttribute('id', 'canvas');
        container.setAttribute('ondragstart', 'return false');
        canvasDocument.body.appendChild(container);
        bpmnEditor.init("canvas");

        $(".widgetbox-wrapper").accordion();
        $("img.widgetbox-swimlane").click(function () {
            var num = $(this).attr("data-swimlane");
            if (bpmnEditor.poolselected()) {
                $("<div></div>")
                        .addClass("dialog-screenmask")
                        .appendTo(document.body);
                $("<div></div>")
                        .addClass("popup-window")
                        .addClass("poolselect-confirmation")
                        .append($("<div></div>")
                                    .addClass("dialog-header")
                                    .text("Confirm"))
                        .append($("<div></div>")
                                    .addClass("dialog-text")
                                    .text("This action cause every existing data will be lost, Continue?"))
                        .append($("<div></div>")
                                    .addClass("dialog-footer")
                                    .append($("<button></button>")
                                                .text("Yes")
                                                .addClass("dialog-btn")
                                                .click(function () {
                                                    bpmnEditor.setSwimlane(num);
                                                    $(".poolselect-confirmation").remove();
                                                    $("div.dialog-screenmask:visible").remove();
                                                }))
                                    .append($("<button></button>")
                                                .text("No")
                                                .addClass("dialog-btn")
                                                .click(function () {
                                                    $(".poolselect-confirmation").remove();
                                                    $("div.dialog-screenmask:visible").remove();
                                                })))
                        .appendTo(document.body)
                        .css({ top: "40%", left: "40%" });
            } else {
                bpmnEditor.setSwimlane(num);
            }
        });

        $("img.widgetbox-activity")
            .add("img.widgetbox-gateway")
            .add("img.widgetbox-data")
            .draggable({
                scope: "widget",
                helper: "clone",
                revert: "invalid",
                zIndex: 100,
                revertDuration: 400,
                appendTo: document.body,
                containment: "parent",
                iframeFix: true,
                start: function () {
                    bpmnEditor.swimlaneDroppable(true);
                },
                stop: function () {
                    bpmnEditor.swimlaneDroppable(false);
                }
            });

        $("img.widgetbox-event")
            .draggable({
                scope: "widget",
                helper: "clone",
                revert: "invalid",
                zIndex: 100,
                revertDuration: 400,
                appendTo: document.body,
                containment: "parent",
                iframeFix: true,
                start: function () {
                    bpmnEditor.swimActDroppable(true);
                },
                stop: function () {
                    bpmnEditor.swimActDroppable(false);
                }
            });

        $("img.widgetbox-link").parent().click(function () {
            if ($(this).hasClass("button-pressed")) {
                bpmnEditor.linkable(false);
                $(this).removeClass("button-pressed").addClass("hover");
                return;
            }
            $(this).parent().parent().find(".button-pressed").removeClass("button-pressed").addClass("hover");
            $(this).removeClass("hover").addClass("button-pressed");
            bpmnEditor.linkable(true, $(this).children().attr("data-widget-id"));
        });

        $(".toolbox-button").click(function () {
            var editor;
            $("<div></div>")
                .addClass("dialog-screenmask")
                .appendTo(document.body);
            $("<div></div>")
                .addClass("popup-window")
                .addClass("xpdl-editor")
                .append($("<div></div>")
                            .addClass("xpdl-editor-header")
                            .text("XPDL Editor"))
                .append($("<textarea></textarea>")
                            .addClass("textarea-code-editor")
                            .val(bpmnEditor.toXPDL()))
                .append($("<div></div>")
                            .addClass("xpdl-editor-footer")
                            .append($("<button></button>")
                            .text("Apply")
                            .addClass("toolbox-button")
                            .click(function () {
                                var success = bpmnEditor.importXPDL(editor.getValue());
                                if (success) {
                                    $(".xpdl-editor").remove();
                                    $("div.dialog-screenmask:visible").remove();
                                }
                            }))
                            .append($("<button></button>")
                                        .text("Cancel")
                                        .addClass("toolbox-button")
                                        .click(function () {
                                            $(".xpdl-editor").remove();
                                            $("div.dialog-screenmask:visible").remove();
                                        })))
                .appendTo(document.body)
                .css({ top: "10%", left: "20%" })
                .ready(function () {
                    editor = CodeMirror.fromTextArea($("textarea", this)[0], {
                        mode: { name: "xml", alignCDATA: true },
                        theme: "ambiance",
                        matchTags: true,
                        extraKeys: {"Ctrl-J": "toMatchingTag"},
                        lineNumbers: true
                    });
                }).draggable({
                    handle: ".xpdl-editor-header",
                    containment: "parent",
                    opacity: 0.5,
                    cursor: "move"
                });
        });

    });
})(SVG, jQuery, CodeMirror, vkbeautify);