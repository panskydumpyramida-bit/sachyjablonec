/**
 * Admin Users Module
 * User management functions for admin panel
 */

// ================================
// USERS MANAGEMENT
// ================================

async function loadUsers() {
    try {
        const res = await fetch(`${API_URL}/users`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const users = await res.json();

        document.getElementById('usersTableBody').innerHTML = users.map(u => `
            <tr>
                <td>${escapeHtml(u.username)}</td>
                <td>${escapeHtml(u.email || '-')}</td>
                <td>
                    <select onchange="updateUserRole(${u.id}, this.value)" style="padding: 0.25rem;">
                        <option value="USER" ${u.role === 'USER' ? 'selected' : ''}>User</option>
                        <option value="MEMBER" ${u.role === 'MEMBER' ? 'selected' : ''}>Member</option>
                        <option value="ADMIN" ${u.role === 'ADMIN' ? 'selected' : ''}>Admin</option>
                        <option value="SUPERADMIN" ${u.role === 'SUPERADMIN' ? 'selected' : ''}>Superadmin</option>
                    </select>
                </td>
                <td>${new Date(u.createdAt).toLocaleDateString('cs-CZ')}</td>
                <td>
                    ${u.id !== currentUser.id ? `<button class="action-btn btn-delete" onclick="deleteUser(${u.id})"><i class="fa-solid fa-trash"></i></button>` : ''}
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Load users error:', e);
    }
}

async function updateUserRole(id, newRole) {
    try {
        const res = await fetch(`${API_URL}/users/${id}/role`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ role: newRole })
        });

        if (res.ok) {
            showAlert(`Role změněna na ${newRole}`, 'success');
        } else {
            showAlert('Chyba při změně role', 'error');
            loadUsers(); // Revert
        }
    } catch (e) {
        console.error(e);
        showAlert('Chyba spojení', 'error');
    }
}

async function createUser() {
    const username = document.getElementById('newUsername')?.value;
    const email = document.getElementById('newEmail')?.value;
    const password = document.getElementById('newPassword')?.value;
    const role = document.getElementById('newRole')?.value;

    if (!username || !password) {
        showAlert('Vyplňte uživatelské jméno a heslo', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ username, email, password, role })
        });

        if (res.ok) {
            showAlert('Uživatel vytvořen', 'success');
            document.getElementById('newUsername').value = '';
            document.getElementById('newEmail').value = '';
            document.getElementById('newPassword').value = '';
            loadUsers();
        } else {
            const data = await res.json();
            showAlert(data.error || 'Chyba při vytváření uživatele', 'error');
        }
    } catch (e) {
        console.error(e);
        showAlert('Chyba spojení', 'error');
    }
}

async function deleteUser(id) {
    if (!confirm('Opravdu smazat tohoto uživatele?')) return;

    try {
        const res = await fetch(`${API_URL}/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (res.ok) {
            showAlert('Uživatel smazán', 'success');
            loadUsers();
        } else {
            showAlert('Chyba při mazání uživatele', 'error');
        }
    } catch (e) {
        console.error(e);
        showAlert('Chyba spojení', 'error');
    }
}

// Export for global access
window.loadUsers = loadUsers;
window.updateUserRole = updateUserRole;
window.createUser = createUser;
window.deleteUser = deleteUser;
