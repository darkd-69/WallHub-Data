const GITHUB_CONFIG = {
    OWNER: 'darkd-69',
    REPO: 'WallHub-Data',
    PATH: 'database.json'
};

const ADMIN_USERS = [
    { username: 'Spider', password: 'Spider@69' },
    { username: 'Photographer', password: 'Photo@2026' } // Your friend's credentials
];

let database = {
    categories: [],
    wallpapers: []
};

let fileSha = '';

// UI Elements
const statusEl = document.getElementById('status-message');
const mainContent = document.getElementById('main-content');
const loginSection = document.getElementById('login-section');
const configSection = document.getElementById('config-section');
const categorySelect = document.getElementById('wp-category');
const categoryContainer = document.getElementById('category-container');
const wallpaperTable = document.getElementById('wallpaper-table-body');
const totalCountEl = document.getElementById('total-count');
const ghTokenInput = document.getElementById('github-token');

function showStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.className = `status-bar ${isError ? 'status-error' : 'status-success'}`;
    statusEl.classList.remove('hidden');
    setTimeout(() => statusEl.classList.add('hidden'), 5000);
}

// --- Authentication Logic ---

function handleLogin() {
    const user = document.getElementById('admin-username').value;
    const pass = document.getElementById('admin-password').value;
    const errorEl = document.getElementById('login-error');

    const foundUser = ADMIN_USERS.find(u => u.username === user && u.password === pass);

    if (foundUser) {
        sessionStorage.setItem('is_admin', 'true');
        sessionStorage.setItem('admin_name', foundUser.username);
        checkAuthState();
    } else {
        showStatus("Wrong Username or Password!", true);
        errorEl.textContent = "Invalid Username or Password";
        errorEl.classList.remove('hidden');
    }
}

function togglePassword() {
    const passInput = document.getElementById('admin-password');
    const toggleIcon = document.getElementById('toggle-password');

    if (passInput.type === 'password') {
        passInput.type = 'text';
        toggleIcon.textContent = '🔒';
    } else {
        passInput.type = 'password';
        toggleIcon.textContent = '👁️';
    }
}

function handleLogout() {
    sessionStorage.removeItem('is_admin');
    window.location.reload();
}

function checkAuthState() {
    const isAdmin = sessionStorage.getItem('is_admin') === 'true';
    if (isAdmin) {
        loginSection.classList.add('hidden');
        configSection.classList.remove('hidden');

        const name = sessionStorage.getItem('admin_name') || 'Admin';
        document.getElementById('admin-display-name').textContent = name;

        // Auto-load token if it exists
        const savedToken = localStorage.getItem('gh_token');
        if (savedToken) {
            ghTokenInput.value = savedToken;
            fetchFromGitHub();
        }
    } else {
        loginSection.classList.remove('hidden');
        configSection.classList.add('hidden');
        mainContent.classList.add('hidden');
    }
}

// Run on start
checkAuthState();

// --- GitHub Logic ---

async function fetchFromGitHub() {
    const token = ghTokenInput.value;
    if (!token) {
        showStatus('Please enter a GitHub token', true);
        return;
    }

    try {
        const url = `https://api.github.com/repos/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}/contents/${GITHUB_CONFIG.PATH}`;
        const response = await fetch(url, {
            headers: { 'Authorization': `token ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch database. Check token and permissions.');

        const data = await response.json();
        fileSha = data.sha;
        const decodedContent = decodeURIComponent(escape(atob(data.content)));
        database = JSON.parse(decodedContent);

        // Save token to localStorage for next time
        localStorage.setItem('gh_token', token);

        renderUI();
        mainContent.classList.remove('hidden');
        showStatus('Database loaded successfully!');
    } catch (error) {
        showStatus(error.message, true);
    }
}

function renderUI() {
    categorySelect.innerHTML = database.categories.map(c => `<option value="${c}">${c}</option>`).join('');
    categoryContainer.innerHTML = database.categories.map(c => `
        <div class="category-chip">
            ${c}
            <span class="chip-delete" onclick="deleteCategory('${c}')">&times;</span>
        </div>
    `).join('');

    wallpaperTable.innerHTML = database.wallpapers.map((wp, index) => `
        <tr>
            <td><img src="${wp.imageUrl}" class="preview-img" onerror="this.src='https://placehold.co/60x80?text=Error'"></td>
            <td>${wp.title}</td>
            <td>${wp.category}</td>
            <td><button class="delete-btn" onclick="deleteWallpaper(${index})">Delete</button></td>
        </tr>
    `).reverse().join('');

    totalCountEl.textContent = database.wallpapers.length;
}

// Actions
window.deleteCategory = async (name) => {
    if (!confirm(`Delete category "${name}"?`)) return;
    database.categories = database.categories.filter(c => c !== name);
    await saveToGitHub();
};

window.deleteWallpaper = async (index) => {
    if (!confirm('Are you sure?')) return;
    const actualIndex = database.wallpapers.length - 1 - index;
    database.wallpapers.splice(actualIndex, 1);
    await saveToGitHub();
};

async function addCategory() {
    const input = document.getElementById('new-category');
    const name = input.value.trim();
    if (!name || database.categories.includes(name)) return;
    database.categories.push(name);
    database.categories.sort();
    input.value = '';
    await saveToGitHub();
}

async function addWallpaper() {
    const title = document.getElementById('wp-title').value;
    const category = document.getElementById('wp-category').value;
    const imageUrl = document.getElementById('wp-url').value;
    if (!title || !imageUrl) return;

    database.wallpapers.push({
        id: Date.now().toString(),
        title, category, imageUrl,
        thumbnailUrl: document.getElementById('wp-thumb').value || imageUrl
    });
    await saveToGitHub();
}

async function bulkAdd() {
    const jsonInput = document.getElementById('bulk-json').value;
    try {
        const items = JSON.parse(jsonInput);
        items.forEach(item => {
            database.wallpapers.push({
                id: (Date.now() + Math.random()).toString(),
                title: item.title, category: item.category, imageUrl: item.imageUrl,
                thumbnailUrl: item.thumbnailUrl || item.imageUrl
            });
        });
        document.getElementById('bulk-json').value = '';
        await saveToGitHub();
    } catch (e) { showStatus('Invalid JSON', true); }
}

async function saveToGitHub() {
    const token = localStorage.getItem('gh_token');
    const url = `https://api.github.com/repos/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}/contents/${GITHUB_CONFIG.PATH}`;

    try {
        const jsonStr = JSON.stringify(database, null, 2);
        const content = btoa(unescape(encodeURIComponent(jsonStr)));

        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Update database', content: content, sha: fileSha })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(`GitHub Error: ${err.message}`);
        }

        const data = await response.json();
        fileSha = data.content.sha;
        renderUI();
        showStatus('Saved successfully!');
    } catch (error) { showStatus(error.message, true); }
}

// Event Listeners
document.getElementById('login-btn').addEventListener('click', handleLogin);
document.getElementById('logout-btn').addEventListener('click', handleLogout);
document.getElementById('load-db').addEventListener('click', fetchFromGitHub);
document.getElementById('add-btn').addEventListener('click', addWallpaper);
document.getElementById('add-cat-btn').addEventListener('click', addCategory);
document.getElementById('bulk-add-btn').addEventListener('click', bulkAdd);
document.getElementById('toggle-password').addEventListener('click', togglePassword);
