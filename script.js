document.addEventListener('DOMContentLoaded', () => {
    const boardElement = document.getElementById('board');
    const currentPlayerElement = document.getElementById('current-player');
    const messageElement = document.getElementById('message');
    const passButton = document.getElementById('pass-button');
    const resetButton = document.getElementById('reset-button');

    let board = [['', '', ''], ['', '', ''], ['', '', '']];
    let currentPlayer = 'O'; // Oが先行
    const players = ['X', 'O'];
    let gameOver = false;

    // 各プレイヤーが最後にマークを置いた位置 (隣接禁止ルール用)
    // { X: {row: -1, col: -1}, O: {row: -1, col: -1} }
    let lastPlacedPositions = {};

    // 各プレイヤーが直前の自分の手番でパスしたか (同一プレイヤー連続パス判定用)
    // { X: false, O: false }
    let playerJustMadeAPass = {};

    // ゲーム全体で直前の手番がパスだったか (異プレイヤー間連続パス判定用)
    let overallLastActionWasPass = false;

    // 各プレイヤーがパス後の制約解除状態か
    // { X: false, O: false }
    let playerHasConstraintLifted = {};

    function initializeGame() {
        board = [['', '', ''], ['', '', ''], ['', '', '']];
        currentPlayer = 'O';
        gameOver = false;
        lastPlacedPositions = { X: { row: -1, col: -1 }, O: { row: -1, col: -1 } };
        playerJustMadeAPass = { X: false, O: false };
        overallLastActionWasPass = false;
        playerHasConstraintLifted = { X: false, O: false };

        currentPlayerElement.textContent = `現在のプレイヤー: ${currentPlayer}`;
        messageElement.textContent = '';
        renderBoard();
    }

    function renderBoard() {
        boardElement.innerHTML = '';
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.row = r;
                cell.dataset.col = c;
                cell.textContent = board[r][c];
                if (board[r][c] === 'X') cell.classList.add('X');
                if (board[r][c] === 'O') cell.classList.add('O');

                if (!gameOver && !isValidPlacement(r, c, currentPlayer)) {
                    cell.classList.add('disabled');
                } else if (!gameOver && board[r][c] === '') {
                     cell.addEventListener('click', handleCellClick);
                } else if (gameOver || board[r][c] !== '') {
                    cell.style.cursor = 'default';
                }
                boardElement.appendChild(cell);
            }
        }
    }

    function isValidPlacement(row, col, player) {
        if (board[row][col] !== '') return false; // マスが空でない

        // パス後の制約解除状態ならどこでも置ける
        if (playerHasConstraintLifted[player]) {
            return true;
        }

        // 隣接配置制約
        const lastPos = lastPlacedPositions[player];
        if (lastPos.row !== -1) { // 初手でない場合
            const dr = Math.abs(row - lastPos.row);
            const dc = Math.abs(col - lastPos.col);
            if (dr <= 1 && dc <= 1) { // 隣接マス(斜め含む)
                return false;
            }
        }
        return true;
    }

    function countMarks() {
        let countX = 0;
        let countO = 0;
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                if (board[r][c] === 'X') countX++;
                if (board[r][c] === 'O') countO++;
            }
        }
        return { X: countX, O: countO };
    }

    function checkWin() {
        const lines = [
            // Rows
            [[0, 0], [0, 1], [0, 2]], [[1, 0], [1, 1], [1, 2]], [[2, 0], [2, 1], [2, 2]],
            // Columns
            [[0, 0], [1, 0], [2, 0]], [[0, 1], [1, 1], [2, 1]], [[0, 2], [1, 2], [2, 2]],
            // Diagonals
            [[0, 0], [1, 1], [2, 2]], [[0, 2], [1, 1], [2, 0]]
        ];

        for (const line of lines) {
            const [a, b, c] = line;
            if (board[a[0]][a[1]] && board[a[0]][a[1]] === board[b[0]][b[1]] && board[a[0]][a[1]] === board[c[0]][c[1]]) {
                return board[a[0]][a[1]]; // 勝者マーク
            }
        }

        // 全マス埋まり
        let isBoardFull = true;
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                if (board[r][c] === '') {
                    isBoardFull = false;
                    break;
                }
            }
            if (!isBoardFull) break;
        }

        if (isBoardFull) {
            const marks = countMarks();
            if (marks.X > marks.O) return 'X';
            if (marks.O > marks.X) return 'O';
            return 'Draw'; // 引き分け
        }
        return null; // ゲーム継続
    }

    function handleCellClick(event) {
        if (gameOver) return;
        const row = parseInt(event.target.dataset.row);
        const col = parseInt(event.target.dataset.col);

        if (!isValidPlacement(row, col, currentPlayer)) {
            messageElement.textContent = 'ここには置けません。';
            return;
        }

        board[row][col] = currentPlayer;
        lastPlacedPositions[currentPlayer] = { row, col };
        playerHasConstraintLifted[currentPlayer] = false; // 制約解除状態は1回で終了
        playerJustMadeAPass[currentPlayer] = false;
        overallLastActionWasPass = false;

        const winner = checkWin();
        if (winner) {
            endGame(winner);
        } else {
            switchPlayer();
        }
        renderBoard();
    }

    function handlePass() {
        if (gameOver) return;

        // 連続パスによる敗北判定
        if (overallLastActionWasPass) { // 異プレイヤー間の連続パス (例: Xがパス -> Oがパス)
            endGame(currentPlayer === 'X' ? 'O' : 'X', `${currentPlayer}の負け (連続パス)`);
            return;
        }
        if (playerJustMadeAPass[currentPlayer]) { // 同一プレイヤーの連続パス (例: Xがパス -> Oが置く -> Xがパス)
             endGame(currentPlayer === 'X' ? 'O' : 'X', `${currentPlayer}の負け (連続パス)`);
            return;
        }

        messageElement.textContent = `${currentPlayer}がパスしました。`;
        playerHasConstraintLifted[currentPlayer] = true; // 次の手番で制約解除
        playerJustMadeAPass[currentPlayer] = true;
        overallLastActionWasPass = true;

        // パスしても勝利条件はチェック (万が一パスで全マス埋まる等の状況があれば)
        const winner = checkWin();
        if (winner) {
             endGame(winner);
        } else {
            switchPlayer();
        }
        renderBoard();
    }

    function switchPlayer() {
        currentPlayer = (currentPlayer === 'X') ? 'O' : 'X';
        currentPlayerElement.textContent = `現在のプレイヤー: ${currentPlayer}`;
        // メッセージは適宜更新。ここではクリアしないでおく。
    }

    function endGame(winner, customMessage = '') {
        gameOver = true;
        if (customMessage) {
            messageElement.textContent = customMessage;
        } else if (winner === 'Draw') {
            messageElement.textContent = '引き分けです！';
        } else {
            messageElement.textContent = `プレイヤー ${winner} の勝利です！`;
        }
        currentPlayerElement.textContent = "ゲーム終了";
    }

    passButton.addEventListener('click', handlePass);
    resetButton.addEventListener('click', initializeGame);

    initializeGame(); // ゲーム開始
});