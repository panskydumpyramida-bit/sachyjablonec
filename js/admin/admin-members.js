/**
 * Admin Members Module
 * Contains: Member management (CRUD)
 */

let allMembers = [];

async function loadMembers() {
    try {
        const res = await fetch(`${API_URL}/members`);
        allMembers = await res.json();
        renderMembersTable();
    } catch (e) {
        console.error(e);
        showAlert('Chyba při načítání členů', 'error');
    }
}

function renderMembersTable() {
    const tbody = document.getElementById('membersTableBody');
    if (!tbody) return;

    tbody.innerHTML = allMembers.map(m => `
        <tr>
            <td><strong>${escapeHtml(m.firstName)} ${escapeHtml(m.lastName)}</strong></td>
            <td>${escapeHtml(m.elo || '-')}</td>
            <td>${escapeHtml(m.title || '-')}</td>
            <td>${escapeHtml(m.birthYear || '-')}</td>
            <td>${escapeHtml(m.role || '-')}</td>
            <td>
                <button class="action-btn btn-edit" onclick="editMember(${m.id})"><i class="fa-solid fa-edit"></i></button>
                <button class="action-btn btn-delete" onclick="deleteMember(${m.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function openMemberModal(member = null) {
    const modal = document.getElementById('memberModal');
    const title = document.getElementById('memberModalTitle');

    if (!modal) return;

    if (member) {
        title.textContent = 'Upravit člena';
        document.getElementById('memberId').value = member.id;
        document.getElementById('memberFirstName').value = member.firstName;
        document.getElementById('memberLastName').value = member.lastName;
        document.getElementById('memberElo').value = member.elo || '';
        document.getElementById('memberTitle').value = member.title || '';
        document.getElementById('memberBirthYear').value = member.birthYear || '';
        document.getElementById('memberRole').value = member.role || '';
    } else {
        title.textContent = 'Nový člen';
        document.getElementById('memberId').value = '';
        document.getElementById('memberFirstName').value = '';
        document.getElementById('memberLastName').value = '';
        document.getElementById('memberElo').value = '';
        document.getElementById('memberTitle').value = '';
        document.getElementById('memberBirthYear').value = '';
        document.getElementById('memberRole').value = '';
    }

    modal.style.display = 'flex';
}

function closeMemberModal() {
    const modal = document.getElementById('memberModal');
    if (modal) modal.style.display = 'none';
}

async function saveMember() {
    const id = document.getElementById('memberId').value;
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/members/${id}` : `${API_URL}/members`;

    const data = {
        firstName: document.getElementById('memberFirstName').value.trim(),
        lastName: document.getElementById('memberLastName').value.trim(),
        elo: document.getElementById('memberElo').value,
        title: document.getElementById('memberTitle').value,
        birthYear: document.getElementById('memberBirthYear').value,
        role: document.getElementById('memberRole').value
    };

    if (!data.firstName || !data.lastName) {
        alert('Jméno a příjmení jsou povinné.');
        return;
    }

    try {
        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            showAlert('Uloženo!', 'success');
            closeMemberModal();
            loadMembers();
        } else {
            showAlert('Chyba při ukládání', 'error');
        }
    } catch (e) {
        console.error(e);
        showAlert('Chyba spojení', 'error');
    }
}

function editMember(id) {
    const member = allMembers.find(m => m.id === id);
    if (member) openMemberModal(member);
}

async function deleteMember(id) {
    if (!confirm('Opravdu smazat tohoto člena?')) return;

    try {
        const res = await fetch(`${API_URL}/members/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (res.ok) {
            showAlert('Smazáno!', 'success');
            loadMembers();
        } else {
            showAlert('Chyba při mazání', 'error');
        }
    } catch (e) {
        console.error(e);
        showAlert('Chyba spojení', 'error');
    }
}

// Export functions to window
window.loadMembers = loadMembers;
window.renderMembersTable = renderMembersTable;
window.openMemberModal = openMemberModal;
window.closeMemberModal = closeMemberModal;
window.saveMember = saveMember;
window.editMember = editMember;
window.deleteMember = deleteMember;
