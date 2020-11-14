class Label {
	constructor(position, text, size, align, font) {
		// if (logFull) console.log("%s(%j)", arguments.callee.name, Array.prototype.slice.call(arguments).sort());
		//x and y are integers betweem 0 and 1. Use as percentages.
		this.position = position;
		this.text = text;
		this.data = "";
		this.size = size;
		this.font = font ? font : LABEL_FONT;
		this.align = align ? align : "center";
		this.visible = true;
		this.opacity = 1;
	}

	msg() {
		return this.text + this.data;
	}

	disable() {}

	dims() {
		ctx.font = (this.size * r) + "px " + this.font;
		var metrics = ctx.measureText(this.msg())
		return {
			width: metrics.width,
			height: metrics.actualBoundingBoxAscent,
		}
	}

	draw(absolute = false) {
		if (!this.visible) { return; }
		if (this.opacity < 1) {
			ctx.save();
			ctx.globalAlpha = this.opacity;
		}

		ctx.strokeStyle = "black";
		ctx.fillStyle = "black";
		ctx.font = (this.size * r) + "px " + this.font;
	
		ctx.textBaseline = "center";
		ctx.textAlign = this.align;
		if (absolute) {
			ctx.fillText(this.msg(), this.position.x, this.position.y);
		} else {
			ctx.fillText(this.msg(), canvas.width * this.position.x, canvas.height * this.position.y);
		}
		if (this.opacity < 1) {
			ctx.restore();
		}
	}
}

class Button {
	constructor(position, text, size, callback, uncallback, holdable, align, border, margin, font) {
		this.position = position;
		this.text = text;
		this.size = size;
		this.font = font ? font : LABEL_FONT;
		this.align = align ? align : "center";
		this.callback = callback;
		this.uncallback = uncallback;
		this.down = false;
		this.enabled = false;
		this.visible = true;
		this.focus = false;
		this.clicked = false;
		this.undoEnabled = true;
		this.margin = margin || 20;
		this.border = border === undefined ? true : border;
		this.holdable = holdable;
		this.holdTicks = 0;
	}

	checkHold() {
		if (!this.holdable || !this.enabled || !this.down) {
			return;
		}
		if (isOnButton(this)) {
			this.holdTicks += 1;
			if (this.holdTicks === 15) {
				this.click();
				this.holdTicks = 0;
			} 
		}
	}

	toggle() {
		if (!this.enabled) {
			return;
		}
		if (this.clicked) {
			this.unclick();
		} else {
			this.click();
		}
	}

	click() {
		if (!this.enabled) {
			return;
		}
		if (!this.clicked) {
			if (this.uncallback) {
				this.clicked = true;
			}
			this.callback();
		}
	}

	unclick() {
		if (!this.enabled) {
			return;
		}
		if (this.clicked && this.uncallback && this.undoEnabled) {
			this.clicked = false;
			this.uncallback();
		}
	}

	enable(preserveClick) {
		this.visible = true;
		this.enabled = true;
		if (!preserveClick) {
			this.clicked = false;
		}
		this.undoEnabled = true;
	}

	disable() {
		this.visible = false;
		this.enabled = false;
	}

	disableUndo() {
		this.undoEnabled = false;
	}

	dims() {
		ctx.font = (this.size * r) + "px " + this.font;
		var metrics = ctx.measureText(this.text)
		return {
			width: metrics.width,
			height: metrics.actualBoundingBoxAscent,
		}
	}

	buttonDims() {
		var dims = this.dims();
		var margin = this.margin * r;
	
		// Top left corner.
		var minX = canvas.width * this.position.x - margin * 0.5;
		if (this.align === "center") {
			minX -= dims.width / 2;
		} else if (this.align === "right") {
			minX -= dims.width;
		}
		var minY = canvas.height * this.position.y - dims.height - margin * 0.5;
		var maxX = minX + dims.width + margin;
		var maxY = minY + dims.height + margin;
		
		return {
			left: minX,
			right: maxX,
			top: minY,
			bot: maxY,
			width: dims.width + margin,
			height: dims.height + margin,
		}
	}

	draw(absolute = false) {
		if (!this.visible) { return; }

		if (this.focus || this.clicked) {
			ctx.strokeStyle = POKER_RED;
			ctx.fillStyle = POKER_RED;
		} else if (this.enabled) {
			ctx.strokeStyle = "black";
			ctx.fillStyle = "black";
		} else {
			ctx.strokeStyle = "grey";
			ctx.fillStyle = "grey";
		}
		ctx.font = (this.size * r) + "px " + this.font;
	
		var buttonDims = this.buttonDims();
		ctx.lineWidth = this.border * r;
		ctx.lineJoin = "round";
		if (this.border) {
			ctx.strokeRect(buttonDims.left, buttonDims.top, buttonDims.width, buttonDims.height);
		}

		ctx.textBaseline = "center";
		ctx.textAlign = this.align;
		if (absolute) {
			ctx.fillText(this.msg(), this.position.x, this.position.y);
		} else {
			ctx.fillText(this.text, canvas.width * this.position.x, canvas.height * this.position.y);
		}
	}
}

class ImageLabel {
	constructor(position, width, height, src) {
		this.position = position;
		this.width = width;
		this.height = height;
		this.img = new Image;
		this.img.src = src;
		this.ratio = this.img.width / this.img.height;
	}

	disable() {}

	dims() {
		return {
			width: canvas.width * this.width,
			height: canvas.height * this.height,
		}
	}

	buttonDims() {
		var dims = this.dims();

		var minX = canvas.width * this.position.x;
		var minY = canvas.height * this.position.y;
		var maxX = minX + dims.width;
		var maxY = minY + dims.height;
		
		return {
			left: minX,
			right: maxX,
			top: minY,
			bot: maxY,
			width: dims.width,
			height: dims.height,
		}
	}

	draw() {
		var h = canvas.height * this.height;
		var w = this.width ? canvas.width * this.width : h * (this.img.width / this.img.height);
		var x = canvas.width * this.position.x - w / 2;
		var y = canvas.height * this.position.y;
		ctx.drawImage(this.img, x, y, w, h);
	}
}

class ImageButton {
	constructor(position, width, height, on_src, callback, off_src, uncallback) {
		this.position = position;
		this.width = width;
		this.height = height;
		this.on_src = on_src;
		this.off_src = off_src;
		this.callback = callback;
		this.uncallback = uncallback;
		this.enabled = true;
		this.visible = true;
		this.on = true;
	}

	src() {
		return this.on ? this.on_src : this.off_src;
	}

	checkHold() {}

	toggle() {
		if (!this.enabled) {
			return;
		}
		if (this.on) {
			this.uncallback();
		} else {
			this.callback();
		}
		this.on = !this.on;
	}

	enable() {
		this.visible = true;
		this.enabled = true;
	}

	disable() {
		this.visible = false;
		this.enabled = false;
	}

	dims() {
		return {
			width: canvas.width * this.width,
			height: canvas.height * this.height,
		}
	}

	buttonDims() {
		var dims = this.dims();

		var minX = canvas.width * this.position.x;
		var minY = canvas.height * this.position.y;
		var maxX = minX + dims.width;
		var maxY = minY + dims.height;
		
		return {
			left: minX,
			right: maxX,
			top: minY,
			bot: maxY,
			width: dims.width,
			height: dims.height,
		}
	}

	draw() {
		if (!this.visible) { return; }
		var img = new Image;
		img.src = this.src();
		var x = canvas.width * this.position.x;
		var y = canvas.height * this.position.y;
		var w = canvas.width * this.width;
		var h = canvas.height * this.height;
		ctx.drawImage(img, x, y, w, h);
	}
}

class Checkbox {
	constructor(position, size, callback) {
		this.position = position;
		this.size = size;
		this.callback = callback;
		this.down = false;
		this.enabled = false;
		this.visible = true;
		this.clicked = false;
	}

	checkHold() {}

	toggle() {
		if (!this.enabled) {
			return;
		}
		this.clicked = !this.clicked;
		if (this.callback) {
			this.callback();
		}
	}

	enable() {
		this.enabled = true;
	}

	disable() {
		this.enabled = false;
	}

	dims() {
		return {
			width: canvas.width * this.size,
			height: canvas.width * this.size,
		}
	}

	buttonDims() {
		var dims = this.dims();
	
		// Top left corner.
		var minX = canvas.width * this.position.x - dims.width * 0.5;
		var minY = canvas.height * this.position.y - dims.height * 0.5;
		var maxX = minX + dims.width;
		var maxY = minY + dims.height;
		
		return {
			left: minX,
			right: maxX,
			top: minY,
			bot: maxY,
			width: dims.width,
			height: dims.height,
		}
	}

	draw() {
		if (!this.visible) { return; }

		if (this.enabled) {
			ctx.strokeStyle = "black";
			ctx.fillStyle = "black";
		} else {
			ctx.strokeStyle = "gray";
			ctx.fillStyle = "gray";
		}
	
		var buttonDims = this.buttonDims();
		ctx.lineWidth = 1 * r;
		ctx.lineJoin = "round";
		
		if (this.clicked) {
			ctx.fillRect(buttonDims.left, buttonDims.top, buttonDims.width, buttonDims.height);
		} else {
			ctx.strokeRect(buttonDims.left, buttonDims.top, buttonDims.width, buttonDims.height);
		}
	}
}

class DrawGroup {
	constructor(draws) {
		this.draws = draws;
	}

	draw() {
		for (var d of this.draws) {
			d.draw();
		}
	}
}

class ButtonGroup  {
	constructor(buttons) {
		this.buttons = buttons;
	}

	enable() {
		for (var b of this.buttons) {
			b.enable();
		}
	}
	
	disable() {
		for (var b of this.buttons) {
			b.disable();
		}
	}
}