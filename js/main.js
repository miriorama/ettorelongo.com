class Util{
    static mapRange(x, inMin, inMax, outMin, outMax) {
        return outMin + ( (x - inMin) * (outMax - outMin) ) / (inMax - inMin);
    }
    static mapToDeg(v) {
        return Math.max(-1, Math.min(1, v)) * 45;
    }
    static exp(x, k=3) {
        return Math.pow(x, k);
    }
    static random(min=0, max=1) {
        return Math.random() * (max - min) + min;
    }

    static mapToHex(v) {
    const n = Math.round(v * 255);
    return n.toString(16).padStart(2, '0');
    }

    static hslToHex(h, s, l, a = 1) {
        // normalizza
        s /= 100;
        l /= 100;

        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l - c / 2;

        let r = 0, g = 0, b = 0;

        if (0 <= h && h < 60) { r = c; g = x; b = 0; }
        else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
        else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
        else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
        else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }

        r = Math.round((r + m) * 255);
        g = Math.round((g + m) * 255);
        b = Math.round((b + m) * 255);
        const alpha = Math.round(a * 255);

        // helper
        const hex = n => n.toString(16).padStart(2, '0');

        return `#${hex(r)}${hex(g)}${hex(b)}${hex(alpha)}`;
    }

    static hexToRgba(hex) {
        hex = hex.replace('#', '').trim();

        // formati corti tipo #RGB o #RGBA → espansione
        if (hex.length === 3) {
            hex = hex.split('').map(x => x + x).join('') + "ff";
        }
        else if (hex.length === 4) {
            hex = hex.split('').map(x => x + x).join('');
        }

        // ora abbiamo 6 (RRGGBB) o 8 (RRGGBBAA) caratteri
        if (hex.length === 6) hex += "ff";

        if (hex.length !== 8) {
            // fallback
            return { r: 255, g: 255, b: 255, a: 255 };
        }

        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const a = parseInt(hex.substring(6, 8), 16);

        return { r, g, b, a };
    }

    static rgbaToHex(r, g, b, a = 255) {
        const toHex = v => v.toString(16).padStart(2, '0');
        return "#" + toHex(r) + toHex(g) + toHex(b) + toHex(a);
    }

    static lerpColor(c1, c2, t=1) {
        const a = Util.hexToRgba(c1);
        const b = Util.hexToRgba(c2);

        const r = Math.round(a.r + (b.r - a.r) * t);
        const g = Math.round(a.g + (b.g - a.g) * t);
        const b2 = Math.round(a.b + (b.b - a.b) * t);
        const alpha = Math.round(a.a + (b.a - a.a) * t);

        return Util.rgbaToHex(r, g, b2, alpha);
    }
}

class Ui {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // griglia
        this.cols = 0;
        this.rows = 0;
        this.cellWidth = 0;
        this.cellHeight = 0;
        this.lineLength = 0;
        this.lines = [];

        this.waves = []; // {x, y, start}

        this.backgroundColor = '#675867';
        this.lightColor = "#949194";
        this.accentColor = "#CAD5CA";

        // onde
        this.waveSpeed = 800;      // px/s
        this.waveThickness = 100;   // px
        this.waveLifetime = 8000;  // ms

        // input
        this.mouseX = 0;
        this.mouseY = 0;
        this.hasMouse = false;

        this.debug = document.querySelector('.debug');

        // chaos & pattern
        this.chaosAmount = 0;       // 0 verticali, 1 casuali
        this.currentPatternName = "vertical";
        this.lastPatternApplied = "";

        // sezioni per scroll-pattern
        this.sections = Array.from(document.querySelectorAll('.section'));

        // setup
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.bindEvents();
        this.applyVerticalPattern();
        this.animate();
    }

    // ------ griglia ------
    resizeCanvas() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
        this.initLines();
        this.applyPattern(this.currentPatternName)
    }

    initLines() {
        this.cols = Math.floor(this.canvas.width / 30);
        this.rows = Math.floor(this.canvas.height / 30);
        this.cellWidth = this.canvas.width / this.cols;
        this.cellHeight = this.canvas.height / this.rows;
        this.lineLength = Math.min(this.cellWidth, this.cellHeight) * 0.6;

        this.lines = [];
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const x = col * this.cellWidth + this.cellWidth / 2;
                const y = row * this.cellHeight + this.cellHeight / 2;
                this.lines.push({
                    x,
                    y,
                    row,
                    col,
                    // angoli
                    angle: 0,
                    targetAngle: 0,
                    baseAngle: Math.PI / 2,           // verticale
                    randomAngle: (Math.random() * (90 * Math.PI / 180)),
                    // colori
                    color: this.backgroundColor,
                    targetColor: this.lightColor,
                    baseColor: this.backgroundColor
                });
            }
        }
    }

    // ------ eventi ------
    bindEvents() {
        // mouse
        window.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
            this.hasMouse = true;
        });

        window.addEventListener('mouseleave', () => {
            this.hasMouse = false;
        });

        // scroll: pattern + parallasse
        window.addEventListener('scroll', () => this.onScroll());
        this.onScroll();

        const addWave = (clientX, clientY) => {
            if (clientX == null || clientY == null) return;
            const rect = this.canvas.getBoundingClientRect();
            const x = clientX - rect.left;
            const y = clientY - rect.top;
            this.waves.push({ x, y, start: performance.now() });
        };

        // click/tap compatibile mobile
        window.addEventListener('pointerdown', (e) => {
            addWave(e.clientX, e.clientY);
        });
        window.addEventListener('touchstart', (e) => {
            const touch = e.touches && e.touches[0];
            addWave(touch?.clientX, touch?.clientY);
        });
    }

    onScroll() {
        // parallasse: canvas si sposta leggermente verso l'alto
        const factor = 0.01;
        const offset = window.scrollY * -factor;
        const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
        const scrollProgress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
        const rotate = scrollProgress * 2; // 0 → 15deg verso fine scroll
        this.canvas.style.transform = `translateY(${offset}px) rotate(${rotate}deg)`;

        // pattern in base alla sezione "centrale"
        const viewportCenter = window.innerHeight / 2;
        let closestSection = null;
        let closestDist = Infinity;

        this.sections.forEach(sec => {
            const rect = sec.getBoundingClientRect();
            const secCenter = rect.top + rect.height / 2;
            const dist = Math.abs(secCenter - viewportCenter);
            if (dist < closestDist) {
                closestDist = dist;
                closestSection = sec;
            }
        });

        if (closestSection) {
            const pattern = closestSection.dataset.pattern || "vertical";
            if (pattern !== this.currentPatternName) {
                this.currentPatternName = pattern;
            }
        }
    }

    // ------ pattern ------
    applyPattern(name) {
        this.currentPatternName = name;
        if (name === "vertical") {
            this.applyVerticalPattern();
        } else if (name === "wave") {
            this.applyWavePattern();
        } else if (name === "spiral") {
            this.applySpiralPattern();
        }
    }

    applyVerticalPattern() {
        this.lines.forEach(line => {
            line.baseAngle = Math.PI / 2;
            line.baseColor = this.lightColor + Util.mapToHex(0.2);
        });
    }

    applyWavePattern() {
        const cx = this.cols / 2;
        const cy = this.rows / 2;
        const maxDist = Math.sqrt(cx * cx + cy * cy) || 1;
        this.lines.forEach(line => {
            const colNorm = line.col / this.cols;
            const rowNorm = line.row / this.rows;
            const angle = Math.sin(colNorm * Math.PI * 2 + rowNorm * Math.PI) * 0.8;
            const dx = line.col - cx;
            const dy = line.row - cy;
            const distNorm = Math.min(1, Math.max(0, Math.sqrt(dx * dx + dy * dy) / maxDist));
            const op = (1-distNorm) * 0.5; // opacità cresce verso i bordi
            const color = this.lightColor + Util.mapToHex(op);
            line.baseAngle = angle;
            line.baseColor = color;
        });
    }

    applySpiralPattern() {
        const cx = this.cols / 2;
        const cy = this.rows / 2;
        const maxDist = Math.sqrt(cx * cx + cy * cy) || 1;
        this.lines.forEach(line => {
            const dx = line.col - cx;
            const dy = line.row - cy;
            const dist = Math.sqrt(dx * dx + dy * dy) + 0.0001;
            const angle = Math.atan2(dy, dx) + dist * 0.25;
            const distNorm = Math.min(1, Math.max(0, dist / maxDist));
            const op = (distNorm) * 0.5; // opacità cresce con la distanza dal centro
            const color = this.lightColor + Util.mapToHex(op);
            line.baseAngle = angle;
            line.baseColor = color;
        });
    }

    applyMouseInfluence() {
        if(this.mouseX == 0 && this.mouseY == 0){
            return;
        }
        const mouseCol = Math.floor(this.mouseX / this.cellWidth);
        const mouseRow = Math.floor(this.mouseY / this.cellHeight);

        const size = 12;
        const radiusGrid = size / 2;

        for (let r = mouseRow - radiusGrid * 2; r <= mouseRow + radiusGrid * 2; r++) {
            for (let c = mouseCol - radiusGrid * 2; c <= mouseCol + radiusGrid * 2; c++) {
                if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) {
                    const index = r * this.cols + c;
                    const line = this.lines[index];

                    const dr = r - mouseRow;
                    const dc = c - mouseCol;
                    const gridDist = Math.sqrt(dr * dr + dc * dc);

                    if (gridDist <= radiusGrid) {
                        const weight = 1 - (gridDist / radiusGrid);

                        const dx = this.mouseX - line.x;
                        const dy = this.mouseY - line.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        const angleToMouse = Math.atan2(dy, dx);

                        line.targetAngle = line.baseAngle + (angleToMouse - line.baseAngle) * weight;

                        const maxDistance = radiusGrid * Math.max(this.cellWidth, this.cellHeight);
                        const t = Math.min(distance, maxDistance) / maxDistance; // 0 vicino al mouse, 1 al bordo
                        const hue = Util.mapRange(t, 0, 1, 245, 120); // passa dal viola al verde con la distanza
                        const highlightColor = Util.hslToHex(hue, 70, 60, 1);
                        line.targetColor = Util.lerpColor(line.color, this.accentColor, weight);
                        //line.targetColor = Util.lerpColor('#d3e0d3', this.accentColor, weight);
                    }
                }
            }
        }
    }

    applyWaves(now) {
        // ripulisci onde vecchie
        for (let i = this.waves.length - 1; i >= 0; i--) {
            if (now - this.waves[i].start > this.waveLifetime) {
                this.waves.splice(i, 1);
            }
        }

        this.waves.forEach(wave => {
            const elapsed = (now - wave.start) / 1000;
            const radius = elapsed * this.waveSpeed;

            this.lines.forEach(line => {
                const dx = line.x - wave.x;
                const dy = line.y - wave.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const diff = Math.abs(dist - radius);

                if (diff < this.waveThickness) {
                    const w = 1 - diff / this.waveThickness;

                    const tangentAngle = Math.atan2(dy, dx) + Math.PI / 2;
                    line.targetAngle = line.targetAngle + (tangentAngle - line.targetAngle) * w;

                    const hue = (radius / 4) % 360;
                    const waveColor = Util.hslToHex(hue, 80, 70);
                    //line.targetColor = Util.lerpColor(line.targetColor, waveColor, w);
                    line.targetColor = Util.lerpColor(line.color, this.accentColor, 1);
                }
            });
        });
    }

    updateLine(line) {
        line.angle += (line.targetAngle - line.angle) * 0.1;
        line.color = Util.lerpColor(line.color, line.targetColor, 0.1);

        // base + disturbo controllato da chaosAmount
        const chaoticAngle = line.randomAngle * this.chaosAmount;
        //line.baseAngle = line.baseAngle + chaoticAngle;

        // normalizza target per evitare drift
        //const tau = Math.PI * 2;
        //if (line.baseAngle > tau) {
        //    line.baseAngle = line.baseAngle % tau;
        //} else if (line.baseAngle < -tau) {
        //    line.baseAngle = -(-line.baseAngle % tau);
        //}

        //line.baseAngle = line.baseAngle + (line.randomAngle - line.baseAngle) * this.chaosAmount*0.01;
        //let color = line.baseColor;
        line.targetAngle = line.baseAngle + chaoticAngle;
        line.targetColor = line.baseColor;

        const ctx = this.ctx;
        ctx.save();
        ctx.translate(line.x, line.y);
        ctx.rotate(line.angle);
        ctx.strokeStyle = line.color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-this.lineLength / 2, 0);
        ctx.lineTo(this.lineLength / 2, 0);
        ctx.stroke();
        ctx.restore();
    }

    // ------ animazione ------
    animate() {
        requestAnimationFrame(() => this.animate());

        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = this.backgroundColor;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const now = performance.now();

        if (this.currentPatternName !== this.lastPatternApplied) {
            this.applyPattern(this.currentPatternName);
            this.lastPatternApplied = this.currentPatternName;
        }
            this.applyMouseInfluence(now);
            this.applyWaves(now);

        // update + draw
        this.lines.forEach(line => {
            this.updateLine(line);
        });
    }
}

class Longo {
    static init(){

        Longo.sectionChaosSeeds = [];
        Longo.caosableChaosSeeds = [];

        const canvas = document.getElementById('matrixCanvas');
        const slider = document.getElementById('chaosSlider');

        Longo.visualizer = new Ui(canvas);
        Longo.visualizer.chaosAmount = slider.value

        Longo.sliderChange();
    }

    static sliderChange(){
        Longo.updateSliderUI();
    }

    static initChaosSeeds(force = false, sectionList = null, caosableList = null){
        // genera e memoizza i fattori casuali solo al caricamento per animazioni fluide
        const sections = sectionList || document.querySelectorAll('.section');
        const caosables = caosableList || document.querySelectorAll('.k');

        if(force || !Longo.sectionChaosSeeds || Longo.sectionChaosSeeds.length !== sections.length){
            Longo.sectionChaosSeeds = Array.from(sections).map(() => ({
                rotateSeed: Util.random(-1,1),
                scaleSeed: Util.random(0,1)
            }));
        }

        if(force || !Longo.caosableChaosSeeds || Longo.caosableChaosSeeds.length !== caosables.length){
            Longo.caosableChaosSeeds = Array.from(caosables).map(() => ({
                rotateSeed: Util.random(-1,1),
                scaleXSeed: Util.random(-1,1),
                scaleYSeed: Util.random(-1,1),
                scaleZSeed: Util.random(-1,1)
            }));
        }
    }

    static updateSliderUI(){
        const slider = document.getElementById('chaosSlider');
        const fill = document.getElementById('chaosFill');

        let caosableList = document.querySelectorAll('.k');
        let sectionList = document.querySelectorAll('.section');

        const t = slider.value / slider.max;     // normalizzato 0 → 1
        fill.style.width = (t * 100) + "%";

        let v = Util.exp(t,5);
        Longo.visualizer.chaosAmount = parseFloat(v);

        // se chaos = 0, genera nuovi seed per il prossimo trascinamento
        Longo.initChaosSeeds(t === 0, sectionList, caosableList);

        sectionList.forEach((section, index) => {
            const seeds = Longo.sectionChaosSeeds[index];
            let scale = Util.mapRange(v*seeds.scaleSeed, 0,1,1,2);
            let rotate = Util.mapToDeg(v*seeds.rotateSeed);
            section.style.transform = `rotate(${rotate}deg) scale(${scale})`;
        });

        caosableList.forEach((caosable, index) => {
            const seeds = Longo.caosableChaosSeeds[index];
            let rotate = Util.mapToDeg(v*seeds.rotateSeed);
            let scaleX = Util.mapRange(v*seeds.scaleXSeed, -1,1,0.5,1.5);
            let scaleY = Util.mapRange(v*seeds.scaleYSeed, -1,1,0.5,1.5);
            let scaleZ = Util.mapRange(v*seeds.scaleZSeed, -1,1,0.5,1.5);

            caosable.style.transform = `rotate(${rotate}deg) scaleZ(${scaleZ}) scaleX(${scaleX}) scaleY(${scaleY})`;
            //caosable.style.letterSpacing = Util.mapRange(t*Math.random(), 0,1,-10,2) + 'px';
        });
    };
}
Longo.init();
