class Util{
    static mapRange(x, inMin, inMax, outMin, outMax) {
        return outMin + ( (x - inMin) * (outMax - outMin) ) / (inMax - inMin);
    }
    static exp(x, k=3) {
        return Math.pow(x, k);
    }
    static random(min=0, max=1) {
        return Math.random() * (max - min) + min;
    }
}

class MatrixVisualizer {
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

        // onde
        this.waveSpeed = 800;      // px/s
        this.waveThickness = 100;   // px
        this.waveLifetime = 8000;  // ms

        // input
        this.mouseX = 0;
        this.mouseY = 0;
        this.hasMouse = false;

        // chaos & pattern
        this.chaosAmount = 0.5;       // 0 verticali, 1 casuali
        this.currentPatternName = "vertical";

        // sezioni per scroll-pattern
        this.sections = Array.from(document.querySelectorAll('.section'));

        // setup
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.bindEvents();
        this.applyVerticalPattern();
        this.animate();
    }

    // ------ util colori ------
    hslToHex(h, s, l, a = 1) {
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

    hexToRgb(hex) {
        const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return match ? {
            r: parseInt(match[1], 16),
            g: parseInt(match[2], 16),
            b: parseInt(match[3], 16)
        } : { r: 255, g: 255, b: 255 };
    }

    hexToRgba(hex) {
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

    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b)
            .toString(16)
            .slice(1);
    }

    rgbaToHex(r, g, b, a = 255) {
        const toHex = v => v.toString(16).padStart(2, '0');
        return "#" + toHex(r) + toHex(g) + toHex(b) + toHex(a);
    }

    lerpColor(c1, c2, t=1) {
        const a = this.hexToRgba(c1);
        const b = this.hexToRgba(c2);

        const r = Math.round(a.r + (b.r - a.r) * t);
        const g = Math.round(a.g + (b.g - a.g) * t);
        const b2 = Math.round(a.b + (b.b - a.b) * t);
        const alpha = Math.round(a.a + (b.a - a.a) * t);

        return this.rgbaToHex(r, g, b2, alpha);
    }

    // ------ griglia ------
    resizeCanvas() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
        this.initLines();
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
                    randomAngle: Math.random() * Math.PI * 2,
                    // colori
                    color: "#d3e0d3",
                    targetColor: "#d3e0d3",
                    baseColor: "#d3e0d3"
                });
            }
        }
    }

    // ------ eventi ------
    bindEvents() {
        // mouse
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
            this.hasMouse = true;
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.hasMouse = false;
        });

        // slider
        const slider = document.getElementById('chaosSlider');
        const fill = document.getElementById('chaosFill');
        //const label = document.getElementById('chaosValue');

        if (slider && fill) {
            let caosableList = document.querySelectorAll('.k')
            const updateSliderUI = () => {
                const t = slider.value / slider.max;     // normalizzato 0 → 1
                fill.style.width = (t * 100) + "%";

                let v = Util.exp(t);
                this.chaosAmount = parseFloat(v);

                caosableList.forEach(caosable => {
                    let rotate = Util.mapRange(v*Util.random(-1,1), -1,1,-10,10);
                    let scaleX = Util.mapRange(v*Util.random(-1,1), -1,1,0.5,1.5);
                    let scaleY = Util.mapRange(v*Util.random(-1,1), -1,1,0.5,1.5);
                    let scaleZ = Util.mapRange(v*Util.random(-1,1), -1,1,0.5,1.5);

                    caosable.style.transform = `rotate(${rotate}deg) scaleZ(${scaleZ}) scaleX(${scaleX}) scaleY(${scaleY})`;
                    //caosable.style.letterSpacing = Util.mapRange(t*Math.random(), 0,1,-10,2) + 'px';
                });
            };
            updateSliderUI();
            slider.addEventListener('input', updateSliderUI);
        }

        // scroll: pattern + parallasse
        window.addEventListener('scroll', () => this.onScroll());
        this.onScroll();

        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.waves.push({
                x,
                y,
                start: performance.now()
            });
        });
    }

    onScroll() {
        // parallasse: canvas si sposta leggermente verso l'alto
        const factor = 0.01;
        const offset = window.scrollY * -factor;
        this.canvas.style.transform = `translateY(${offset}px)`;

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
        } else if (name === "longo") {
            this.applyLongoPattern();
        }
    }

    getLetterMap() {
        return {
            'A': [[0,1,1,0],[1,0,0,1],[1,1,1,1],[1,0,0,1],[1,0,0,1]],
            'B': [[1,1,1,0],[1,0,0,1],[1,1,1,0],[1,0,0,1],[1,1,1,0]],
            'C': [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,0],[1,0,0,0,1],[0,1,1,1,0]],
            'D': [[1,1,1,0],[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,1,1,0]],
            'E': [[1,1,1,1],[1,0,0,0],[1,1,1,0],[1,0,0,0],[1,1,1,1]],
            'F': [[1,1,1,1],[1,0,0,0],[1,1,1,0],[1,0,0,0],[1,0,0,0]],
            'G': [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,0],[1,0,1,1,1],[0,1,1,1,1]],
            'H': [[1,0,0,1],[1,0,0,1],[1,1,1,1],[1,0,0,1],[1,0,0,1]],
            'I': [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[1,1,1]],
            'J': [[0,1,1,1],[0,0,1,0],[0,0,1,0],[1,0,1,0],[0,1,0,0]],
            'K': [[1,0,0,1],[1,0,1,0],[1,1,0,0],[1,0,1,0],[1,0,0,1]],
            'L': [[1,0,0,0],[1,0,0,0],[1,0,0,0],[1,0,0,0],[1,1,1,1]],
            'M': [[1,0,0,0,1],[1,1,0,1,1],[1,0,1,0,1],[1,0,0,0,1],[1,0,0,0,1]],
            'N': [[1,0,0,1],[1,1,0,1],[1,0,1,1],[1,0,0,1],[1,0,0,1]],
            'O': [[0,1,1,0],[1,0,0,1],[1,0,0,1],[1,0,0,1],[0,1,1,0]],
            'P': [[1,1,1,0],[1,0,0,1],[1,1,1,0],[1,0,0,0],[1,0,0,0]],
            'Q': [[0,1,1,0],[1,0,0,1],[1,0,0,1],[1,0,1,1],[0,1,1,1]],
            'R': [[1,1,1,0],[1,0,0,1],[1,1,1,0],[1,0,1,0],[1,0,0,1]],
            'S': [[0,1,1,1],[1,0,0,0],[0,1,1,0],[0,0,0,1],[1,1,1,0]],
            'T': [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[0,1,0]],
            'U': [[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,0,0,1],[0,1,1,0]],
            'V': [[1,0,0,0,1],[1,0,0,0,1],[0,1,0,1,0],[0,1,0,1,0],[0,0,1,0,0]],
            'W': [[1,0,0,0,1],[1,0,0,0,1],[1,0,1,0,1],[1,1,0,1,1],[1,0,0,0,1]],
            'X': [[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0],[0,1,0,1,0],[1,0,0,0,1]],
            'Y': [[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0]],
            'Z': [[1,1,1,1,1],[0,0,0,1,0],[0,0,1,0,0],[0,1,0,0,0],[1,1,1,1,1]]
        };
    }

    applyVerticalPattern() {
        const vertical = Math.PI / 2;
        const color = this.hslToHex(120, 12, 90, 1);

        this.lines.forEach(line => {
            line.baseAngle = vertical;
            line.baseColor = '#d3e0d3';
        });
    }

    applyWavePattern() {
        const vertical = Math.PI / 2;
        this.lines.forEach(line => {
            const colNorm = line.col / this.cols;
            const rowNorm = line.row / this.rows;
            const angle = Math.sin(colNorm * Math.PI * 2 + rowNorm * Math.PI) * 0.8;
            const hue = 200 + colNorm * 100;
            const op = colNorm;
            const color = this.hslToHex(120, 12, 90, op);
            line.baseAngle = angle;
            line.baseColor = color;
        });
    }

    applySpiralPattern() {
        const cx = this.cols / 2;
        const cy = this.rows / 2;
        this.lines.forEach(line => {
            const dx = line.col - cx;
            const dy = line.row - cy;
            const dist = Math.sqrt(dx * dx + dy * dy) + 0.0001;
            const angle = Math.atan2(dy, dx) + dist * 0.25;
            const hue = (dist * 15) % 360;
            //const color = this.hslToHex(120, 12, 90, 1);
            const op = Math.abs(hue/360);
            const color = this.hslToHex(120, 12, 90, op);
            line.baseAngle = angle;
            line.baseColor = color;
        });
    }

    applyLongoPattern() {
        this.applyVerticalPattern();
        if(this.canvas.width < 1440){
            return;
        }

        const letters = this.getLetterMap();
        const letterHeight = 5;
        const spacing = 2;
        const color = "#8075ff";

        const measureWord = (word) => {
            let width = 0;
            for (const ch of word.toUpperCase()) {
                if (ch === ' ') {
                    width += 3;
                    continue;
                }
                const letter = letters[ch];
                if (letter) width += letter[0].length + 2;
            }
            return Math.max(width - 2, 0);
        };

        const word1 = "CONTACT";
        const word2 = "ME";

        const totalHeight = letterHeight * 2 + spacing;
        const startRow1 = Math.max(Math.floor((this.rows - totalHeight) / 2), 0);
        const startRow2 = startRow1 + letterHeight + spacing;

        const startCol1 = Math.max(Math.floor((this.cols - measureWord(word1)) / 2), 0);
        const startCol2 = Math.max(Math.floor((this.cols - measureWord(word2)) / 2), 0);

        const drawWord = (word, startRow, startCol) => {
            let currentCol = startCol;
            for (const ch of word.toUpperCase()) {
                if (ch === ' ') {
                    currentCol += 3;
                    continue;
                }
                const letter = letters[ch];
                if (!letter) continue;
                for (let r = 0; r < letter.length; r++) {
                    for (let c = 0; c < letter[r].length; c++) {
                        if (letter[r][c] === 1) {
                            const row = startRow + r;
                            const col = currentCol + c;
                            if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
                                const index = row * this.cols + col;
                                const line = this.lines[index];
                                line.baseColor = color;
                                line.targetColor = color;
                                const jitter = (Math.random() - 0.5) * this.chaosAmount;
                                line.baseAngle = Math.PI / 2.2;
                                line.targetAngle = Math.PI / 1.8;
                            }
                        }
                    }
                }
                currentCol += letter[0].length + 2;
            }
        };

        drawWord(word1, startRow1, startCol1);
        drawWord(word2, startRow2, startCol2);
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
                        const highlightColor = this.hslToHex(hue, 70, 60, 1);
                        line.targetColor = this.lerpColor(line.baseColor, '#8075ff', weight);
                        //line.targetColor = this.lerpColor('#d3e0d3', '#8075ff', weight);
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
                    const waveColor = this.hslToHex(hue, 80, 70);
                    //line.targetColor = this.lerpColor(line.targetColor, waveColor, w);
                    line.targetColor = this.lerpColor(line.baseColor, '#8075ff', 1);
                }
            });
        });
    }

    updateLine(line) {
        line.angle += (line.targetAngle - line.angle) * 0.1;
        line.color = this.lerpColor(line.color, line.targetColor, 0.1);

        const chaos = this.chaosAmount;
        const baseAngle = line.baseAngle;
        const randomAngle = line.randomAngle;

        let angle;
        if(this.currentPatternName == 'vertical'){
            angle = baseAngle + (randomAngle - baseAngle) * chaos;
        }else{
            angle = baseAngle ;
        }
        let color = line.baseColor;
        line.targetAngle = angle;
        line.targetColor = color;
    }

    drawLine(line) {
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
        ctx.fillStyle = "#CAD5CA";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const now = performance.now();


        this.applyPattern(this.currentPatternName);
        this.applyMouseInfluence(now);
        this.applyWaves(now);

        // update + draw
        this.lines.forEach(line => {
            this.updateLine(line);
            this.drawLine(line);
        });
    }
}

const canvas = document.getElementById('matrixCanvas');
const visualizer = new MatrixVisualizer(canvas);
