class GameOfLife {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error(`Canvas with ID "${canvasId}" not found.`);
            this.isValid = false;
            return;
        }
        this.interactionElement = document.getElementById(options.interactionElement || this.canvas);
        this.isValid = true;
        this.ctx = this.canvas.getContext('2d');

        this.initializeOptions(options);
        this.initializeState();
        this.setup();
        this.bindEvents();
    }

    initializeOptions(options) {
        this.cellSize = options.cellSize || 15;
        this.cellSpace = options.cellSpace || 1;
        this.cellColor = options.cellColor || 'rgba(255, 255, 255, 0.7)';
        this.backgroundColor = options.backgroundColor || 'rgba(0, 0, 0, 0.3)';
        this.updateInterval = options.updateInterval || 100;
        this.drawEmptyCells = options.drawEmptyCells || false;
        this.emptyCellColor = options.emptyCellColor || 'rgba(50, 50, 50, 0.1)';
        this.fadeInDuration = options.fadeInDuration || 600;
        this.fadeOutDuration = options.fadeOutDuration || 1000;
        this.shipSpawnInterval = options.shipSpawnInterval || 10000;
        this.maxShips = options.maxShips || 3;
        this.shipSpeed = options.shipSpeed || 0.01;
        this.shipSize = options.shipSize || 4;
        
        this.cellColorRGB = this.extractRGBFromRGBA(this.cellColor);
    }

    initializeState() {
        this.cols = 0;
        this.rows = 0;
        this.grid = [];
        this.nextGrid = [];
        this.alphas = [];
        this.ships = [];
        this.animationFrameId = null;
        this.lastUpdateTime = 0;
        this.lastShipUpdateTime = 0;
        this.shipSpawnTimer = 0;
        this.isPaused = false;
        this.isInteracting = false;
        this.resizeTimeout = null;
        
        this.neighborOffsets = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];
    }

    extractRGBFromRGBA(rgbaString) {
        const match = rgbaString.match(/rgba?\(([^)]+)\)/);
        if (match) {
            const values = match[1].split(',').map(v => parseInt(v.trim()));
            return `rgb(${values[0]}, ${values[1]}, ${values[2]})`;
        }
        return rgbaString;
    }

    setup() {
        if (!this.isValid) return;
        
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
        
        this.cols = Math.max(1, Math.floor(this.canvas.width / this.cellSize));
        this.rows = Math.max(1, Math.floor(this.canvas.height / this.cellSize));
        
        if (this.cols === 0 || this.rows === 0) {
            console.warn(`Canvas "${this.canvas.id}" is too small or hidden, GoL not initialized.`);
            this.isValid = false;
            if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
            return;
        }

        this.isValid = true;
        this.initializeGrids();
        this.randomizeGrid();
        
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.lastUpdateTime = 0;
        this.lastShipUpdateTime = 0;
        this.loop(0);
    }

    initializeGrids() {
        const totalCells = this.cols * this.rows;
        this.grid = new Array(this.cols);
        this.nextGrid = new Array(this.cols);
        this.alphas = new Array(this.cols);
        
        for (let i = 0; i < this.cols; i++) {
            this.grid[i] = new Array(this.rows).fill(0);
            this.nextGrid[i] = new Array(this.rows).fill(0);
            this.alphas[i] = new Array(this.rows).fill(0);
        }
    }

    randomizeGrid() {
        if (!this.isValid) return;
        
        for (let i = 0; i < this.cols; i++) {
            for (let j = 0; j < this.rows; j++) {
                this.grid[i][j] = Math.random() > 0.8 ? 1 : 0;
            }
        }
    }

    clearGrid() {
        if (!this.isValid) return;
        
        for (let i = 0; i < this.cols; i++) {
            this.grid[i].fill(0);
        }
    }
    
    setCells(cellsToSet) {
        if (!this.isValid) return;
        
        for (const cell of cellsToSet) {
            if (cell.x >= 0 && cell.x < this.cols && cell.y >= 0 && cell.y < this.rows) {
                this.grid[cell.x][cell.y] = cell.state;
            }
        }
    }

    drawGrid() {
        if (!this.isValid) return;
        
        this.ctx.fillStyle = this.backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const cellSizeMinusSpace = this.cellSize - this.cellSpace;
        
        for (let i = 0; i < this.cols; i++) {
            const x = i * this.cellSize;
            for (let j = 0; j < this.rows; j++) {
                const alpha = this.alphas[i][j];
                if (alpha === 0 && !this.drawEmptyCells) continue;

                const y = j * this.cellSize;
                this.ctx.globalAlpha = alpha;
                this.ctx.fillStyle = this.cellColorRGB;
                this.ctx.fillRect(x, y, cellSizeMinusSpace, cellSizeMinusSpace);
            }
        }
        this.ctx.globalAlpha = 1;
    }
    
    updateGrid() {
        if (!this.isValid || this.isPaused || this.isInteracting) return;

        for (let i = 0; i < this.cols; i++) {
            for (let j = 0; j < this.rows; j++) {
                const state = this.grid[i][j];
                const neighbors = this.countNeighbors(i, j);

                if (state === 0 && neighbors === 3) {
                    this.nextGrid[i][j] = 1;
                } else if (state === 1 && (neighbors < 2 || neighbors > 3)) {
                    this.nextGrid[i][j] = 0;
                } else {
                    this.nextGrid[i][j] = state;
                }
            }
        }
        
        [this.grid, this.nextGrid] = [this.nextGrid, this.grid];
    }

    updateAlphas(deltaTime) {
        const fadeInStep = deltaTime / this.fadeInDuration;
        const fadeOutStep = deltaTime / this.fadeOutDuration;
        
        for (let i = 0; i < this.cols; i++) {
            for (let j = 0; j < this.rows; j++) {
                const target = this.grid[i][j];
                const current = this.alphas[i][j];
                const diff = target - current;
                
                if (Math.abs(diff) < 0.01) {
                    this.alphas[i][j] = target;
                } else {
                    const step = target ? fadeInStep : fadeOutStep;
                    this.alphas[i][j] = Math.max(0, Math.min(1, current + Math.sign(diff) * step));
                }
            }
        }
    }

    countNeighbors(x, y) {
        if (!this.isValid) return 0;
        
        let sum = 0;
        for (const [dx, dy] of this.neighborOffsets) {
            const col = (x + dx + this.cols) % this.cols;
            const row = (y + dy + this.rows) % this.rows;
            sum += this.grid[col][row];
        }
        return sum;
    }
    
    loop(timestamp) {
        if (!this.lastUpdateTime) this.lastUpdateTime = timestamp;
        if (!this.lastShipUpdateTime) this.lastShipUpdateTime = timestamp;
        
        const delta = timestamp - this.lastUpdateTime;
        const shipDelta = timestamp - this.lastShipUpdateTime;

        this.handleShipSpawning(delta);
        this.handleGameUpdate(delta, timestamp);
        this.updateAlphas(delta);
        this.updateShips(shipDelta);
        this.drawGrid();
        
        this.lastShipUpdateTime = timestamp;
        this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
    }

    handleShipSpawning(delta) {
        this.shipSpawnTimer += delta;
        if (this.shipSpawnTimer >= this.shipSpawnInterval && this.ships.length < this.maxShips) {
            this.shipSpawnTimer = 0;
            this.spawnShip();
        }
    }

    handleGameUpdate(delta, timestamp) {
        if (delta > this.updateInterval) {
            this.lastUpdateTime = timestamp;
            if (!this.isPaused && !this.isInteracting) {
                this.updateGrid();
            }
        }
    }

    spawnShip() {
        const y = Math.floor(Math.random() * this.rows);
        const dir = Math.random() > 0.5 ? 1 : -1;
        const x = dir === 1 ? 0 : this.cols - 1;
        
        this.ships.push({ 
            x: x, 
            y: y, 
            dir: dir,
            position: x
        });
    }

    updateShips(deltaTime) {
        for (let i = this.ships.length - 1; i >= 0; i--) {
            const ship = this.ships[i];
            
            this.spawnShipCells(ship);
            this.updateShipPosition(ship, deltaTime);
            
            if (this.isShipOffScreen(ship)) {
                this.ships.splice(i, 1);
            }
        }
    }

    spawnShipCells(ship) {
        const currentX = Math.floor(ship.position);
        for (let offset = 0; offset < this.shipSize; offset++) {
            const cellX = currentX + offset;
            if (cellX >= 0 && cellX < this.cols) {
                this.grid[cellX][ship.y] = 1;
            }
        }
    }

    updateShipPosition(ship, deltaTime) {
        ship.position += ship.dir * this.shipSpeed * deltaTime;
        ship.x = Math.floor(ship.position);
    }

    isShipOffScreen(ship) {
        return (ship.dir === 1 && ship.position >= this.cols) || 
               (ship.dir === -1 && ship.position + this.shipSize < 0);
    }
    
    moveInteraction(event) {
        if (!this.isValid || this.interactionElement.style.pointerEvents === 'none') return;

        const rect = this.canvas.getBoundingClientRect();
        const events = event.touches ? Array.from(event.touches) : [event];

        for (const e of events) {
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const col = Math.floor(mouseX / this.cellSize);
            const row = Math.floor(mouseY / this.cellSize);

            if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
                this.grid[col][row] = 1;
            }
        }
    }

    bindEvents() {
        if (!this.isValid) return;

        const moveInteraction = (e) => {
            if (this.interactionElement.style.pointerEvents === 'none') return;
            e.preventDefault();
            this.moveInteraction(e);
        };

        document.addEventListener('mousemove', moveInteraction);
        document.addEventListener('touchmove', moveInteraction);

        window.addEventListener('resize', () => {
            if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => {
                if (document.body.contains(this.canvas)) {
                    this.setup();
                } else {
                    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
                    this.isValid = false;
                }
            }, 250);
        });
    }

    pause() { this.isPaused = true; }
    resume() { this.isPaused = false; }
    
    destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }
        this.isValid = false;
    }
}