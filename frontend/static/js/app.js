let currentComandaId = null;
let currentComandaItems = []; // Track current comanda items
let produtos = [];
let categorias = [];
let comandas = [];
let filtroAtual = 'abertas';

let timerInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    // Verifica se já está logado na sessão atual
    if (sessionStorage.getItem('sys_logged_in') === 'true') {
        document.getElementById('lock-screen').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        document.getElementById('user-display').textContent = sessionStorage.getItem('sys_username') || 'Caixa';
        
        // Oculta botão admin se não for admin
        const btnAdmin = document.getElementById('btn-admin-nav');
        const role = sessionStorage.getItem('sys_role');
        const username = sessionStorage.getItem('sys_username');
        if (role !== 'admin' && username !== 'RTSYSTEM') {
            btnAdmin.classList.add('hidden');
        } else {
            btnAdmin.classList.remove('hidden');
        }
    }

    loadProdutos();
    loadComandas();
    loadCategorias();
    loadUsersLogin();
    loadConfigs();

    // Inicia o intervalo de atualização dos timers
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimers, 1000);
});

function updateTimers() {
    const now = new Date();
    document.querySelectorAll('.timer-aguardando').forEach(el => {
        const startTime = new Date(el.dataset.startTime);
        const diff = Math.floor((now - startTime) / 1000);
        
        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;
        
        let timeStr = "";
        if (h > 0) timeStr += `${h}h `;
        timeStr += `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        
        el.textContent = timeStr;
    });
}

async function loadUsersLogin() {
    const select = document.getElementById('sys-username');
    if (!select) return;

    try {
        const response = await fetch('/api/usuarios/publico');
        if (response.ok) {
            const users = await response.json();
            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.username;
                option.textContent = user.username;
                select.appendChild(option);
            });
        }
    } catch (e) {
        console.error('Erro ao carregar usuários:', e);
    }
}

async function tentarLogin() {
    const username = document.getElementById('sys-username').value.trim();
    const senha = document.getElementById('sys-password').value;
    const erro = document.getElementById('login-error');
    
    if (!username || !senha) {
        alert('Preencha o usuário e a senha!');
        return;
    }

    try {
        const response = await fetch('/api/sistema/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username, senha: senha })
        });
        
        if (response.ok) {
            const data = await response.json();
            sessionStorage.setItem('sys_logged_in', 'true');
            sessionStorage.setItem('sys_username', data.user.username);
            sessionStorage.setItem('sys_role', data.user.role);
            
            document.getElementById('lock-screen').style.display = 'none';
            document.getElementById('main-content').style.display = 'block';
            document.getElementById('user-display').textContent = data.user.username;
            
            // Oculta botão admin se não for admin
            const btnAdmin = document.getElementById('btn-admin-nav');
            if (data.user.role !== 'admin' && data.user.username !== 'RTSYSTEM') {
                btnAdmin.classList.add('hidden');
            } else {
                btnAdmin.classList.remove('hidden');
            }
        } else {
            erro.classList.remove('hidden');
            erro.style.display = 'block';
            setTimeout(() => {
                erro.classList.add('hidden');
                erro.style.display = 'none';
            }, 3000);
        }
    } catch (e) {
        console.error(e);
        alert('Erro ao validar login!');
    }
}

function logout() {
    sessionStorage.clear();
    window.location.reload();
}

function getHeaders() {
    return {
        'Content-Type': 'application/json',
        'X-User': sessionStorage.getItem('sys_username') || 'Sistema'
    };
}

async function loadComandas() {
    try {
        const response = await fetch('/api/comandas', {
            headers: getHeaders()
        });
        comandas = await response.json();
        console.log('Comandas carregadas:', comandas);
        aplicarFiltro();
    } catch (error) {
        console.error('Erro ao carregar comandas:', error);
    }
}

function aplicarFiltro() {
    let filtradas = [];
    
    if (filtroAtual === 'abertas') {
        filtradas = comandas.filter(c => c.status !== 'fechada');
    } else if (filtroAtual === 'aguardando') {
        filtradas = comandas.filter(c => c.status === 'aguardando_cozinha');
    } else if (filtroAtual === 'fechadas') {
        filtradas = comandas.filter(c => c.status === 'fechada');
    }
    
    renderComandas(filtradas);
}

function filtrarComandas(tipo) {
    filtroAtual = tipo;

    const botoes = {
        abertas: document.getElementById('btn-filtro-abertas'),
        aguardando: document.getElementById('btn-filtro-aguardando'),
        fechadas: document.getElementById('btn-filtro-fechadas'),
    };

    Object.values(botoes).forEach(btn => {
        btn.classList.remove('filter-btn-active', 'filter-waiting', 'filter-closed');
    });

    if (tipo === 'abertas') {
        botoes.abertas.classList.add('filter-btn-active');
    } else if (tipo === 'aguardando') {
        botoes.aguardando.classList.add('filter-btn-active', 'filter-waiting');
    } else if (tipo === 'fechadas') {
        botoes.fechadas.classList.add('filter-btn-active', 'filter-closed');
    }

    aplicarFiltro();
}

async function loadProdutos() {
    try {
        const response = await fetch('/api/produtos', {
            headers: getHeaders()
        });
        produtos = await response.json();
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
    }
}

async function loadCategorias() {
    try {
        const response = await fetch('/api/categorias', {
            headers: getHeaders()
        });
        categorias = await response.json();
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
    }
}

function renderComandas(lista) {
    const container = document.getElementById('lista-comandas');
    container.innerHTML = '';

    if (lista.length === 0) {
        container.innerHTML = `
            <div class="empty-state col-span-full">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <p class="font-medium text-stone-500">Nenhuma comanda neste filtro</p>
                <p class="text-sm mt-1">Abra uma nova comanda ou altere o filtro</p>
            </div>
        `;
        return;
    }

    lista.forEach(comanda => {
        let badgeClass = 'badge-open';
        let statusText = 'Aberta';
        let statusKey = 'aberta';

        if (comanda.status === 'fechada') {
            badgeClass = 'badge-closed';
            statusText = 'Fechada';
            statusKey = 'fechada';
        } else if (comanda.status === 'aguardando_cozinha') {
            badgeClass = 'badge-waiting';
            statusText = 'Aguardando';
            statusKey = 'aguardando';
        }

        const isMarcada = comanda.forma_pagamento === 'marcar';
        const marcadaBadge = isMarcada ? '<span class="badge badge-marked">Marcada</span>' : '';
        
        let timerHtml = '';
        if (comanda.status === 'aguardando_cozinha') {
            timerHtml = `
                <div class="mt-1 flex items-center gap-1 text-amber-600 font-bold text-xs">
                    <i class="bi bi-stopwatch"></i>
                    <span class="timer-aguardando" data-start-time="${comanda.data_aguardando}">00:00</span>
                </div>
            `;
        }

        let btnEntregue = '';
        if (comanda.status === 'aguardando_cozinha') {
            btnEntregue = `
                <button class="btn btn-success w-full py-3 rounded-xl text-sm font-semibold" onclick="event.stopPropagation(); marcarEntregueLista(${comanda.id})">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                    Marcar entregue
                </button>
            `;
        }

        let btnVisualizar = '';
        if (comanda.status === 'fechada') {
            btnVisualizar = `
                <button class="w-full py-3 bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm border border-stone-200" onclick="event.stopPropagation(); visualizarComanda(${comanda.id})">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                    Visualizar
                </button>
            `;
        }

        const card = `
            <div class="comanda-card status-${statusKey}" onclick="openComanda(${comanda.id})">
                    <div class="flex justify-between items-start mb-3">
                        <div class="flex flex-col">
                            <span class="comanda-numero">#${comanda.numero}</span>
                            ${timerHtml}
                        </div>
                        <div class="flex gap-2 flex-wrap justify-end">
                            ${marcadaBadge}
                            <span class="badge ${badgeClass}">${statusText}</span>
                        </div>
                    </div>
                    <p class="font-semibold text-stone-800 text-base mb-1">${comanda.cliente}</p>
                    ${comanda.mesa ? `<p class="text-sm text-stone-500 mb-3">Mesa ${comanda.mesa}</p>` : ''}
                    <p class="comanda-total text-right">R$ ${comanda.total.toFixed(2).replace('.', ',')}</p>
                    ${btnEntregue || btnVisualizar ? `<div class="space-y-2 mt-3 pt-3 border-t border-stone-100">${btnEntregue}${btnVisualizar}</div>` : ''}
            </div>
        `;
        container.innerHTML += card;
    });
}

async function marcarEntregueLista(comandaId) {
    try {
        const response = await fetch(`/api/comandas/${comandaId}/entregar`, {
            method: 'POST',
            headers: getHeaders()
        });
        const data = await response.json();
        alert(data.message);
        await loadComandas();
    } catch (error) {
        console.error('Erro ao marcar como entregue:', error);
    }
}

function buscarComandas() {
    const termo = document.getElementById('busca').value.toLowerCase();
    
    let baseFiltrada = [];
    if (filtroAtual === 'abertas') {
        baseFiltrada = comandas.filter(c => c.status !== 'fechada');
    } else if (filtroAtual === 'aguardando') {
        baseFiltrada = comandas.filter(c => c.status === 'aguardando_cozinha');
    } else if (filtroAtual === 'fechadas') {
        baseFiltrada = comandas.filter(c => c.status === 'fechada');
    }
    
    const filtradas = baseFiltrada.filter(c => 
        c.numero.toString().includes(termo) || 
        c.cliente.toLowerCase().includes(termo)
    );
    renderComandas(filtradas);
}

function showInicial() {
    document.getElementById('tela-inicial').classList.remove('hidden');
    document.getElementById('tela-abrir-comanda').classList.add('hidden');
    document.getElementById('tela-pedidos').classList.add('hidden');
    loadComandas();
}

function showAbrirComanda() {
    document.getElementById('tela-inicial').classList.add('hidden');
    document.getElementById('tela-abrir-comanda').classList.remove('hidden');
    document.getElementById('tela-pedidos').classList.add('hidden');
}

async function abrirComanda() {
    const cliente = document.getElementById('cliente').value.trim();
    const mesa = document.getElementById('mesa').value.trim();

    if (!cliente) {
        alert('Digite o nome do cliente!');
        return;
    }

    try {
        const response = await fetch('/api/comandas', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ cliente, mesa })
        });
        const data = await response.json();
        currentComandaId = data.id;
        openComanda(currentComandaId);
    } catch (error) {
        console.error('Erro ao abrir comanda:', error);
    }
}

async function openComanda(id) {
    currentComandaId = id;
    currentComandaItems = []; // Reset items when opening new comanda
    
    document.getElementById('tela-inicial').classList.add('hidden');
    document.getElementById('tela-abrir-comanda').classList.add('hidden');
    document.getElementById('tela-pedidos').classList.remove('hidden');

    await loadProdutos();
    await loadComandaDetalhes(); // This will render products with highlighting
}

function renderProdutos() {
    console.log("Renderizando produtos...");
    console.log("Produtos carregados:", produtos);
    console.log("Categorias carregadas:", categorias);
    const container = document.getElementById('categorias-produtos');
    container.innerHTML = '';

    // Get product IDs that are currently in the comanda
    const productIdsInComanda = currentComandaItems.map(item => item.produto_id);

    categorias.forEach(cat => {
        const produtosCategoria = produtos.filter(p => p.categoria_id === cat.id);
        console.log(`Categoria ${cat.nome} (ID ${cat.id}): ${produtosCategoria.length} produtos`);
        if (produtosCategoria.length === 0) return;

        let html = `
            <section class="categoria-section">
                <header class="categoria-header">${cat.nome}</header>
                <div class="p-4">
                    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        `;

        produtosCategoria.forEach(prod => {
            console.log(`Produto ${prod.id}: ${prod.nome}, Imagem URL: '${prod.imagem_url}'`);
            const temImagem = prod.imagem_url && prod.imagem_url.trim() !== '';
            const isInComanda = productIdsInComanda.includes(prod.id);
            html += `
                <button type="button" class="produto-btn flex flex-col ${isInComanda ? 'bg-emerald-100 border-2 border-emerald-500' : ''}" onclick="addItem(${prod.id})">
                    ${temImagem ? `
                        <div class="w-full h-24 bg-stone-100 rounded-lg overflow-hidden mb-2 flex items-center justify-center">
                            <img src="${prod.imagem_url}" alt="${prod.nome}" class="w-full h-full object-cover">
                        </div>
                    ` : `
                        <div class="w-full h-24 bg-stone-100 rounded-lg mb-2 flex items-center justify-center">
                            <svg class="w-8 h-8 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg>
                        </div>
                    `}
                    <span class="nome text-center">${prod.nome}</span>
                    <span class="preco text-center">R$ ${prod.preco.toFixed(2).replace('.', ',')}</span>
                </button>
            `;
        });

        html += `
                    </div>
                </div>
            </section>
        `;
        container.innerHTML += html;
    });
}

async function loadComandaDetalhes() {
    try {
        const response = await fetch(`/api/comandas/${currentComandaId}`, {
            headers: getHeaders()
        });
        const comanda = await response.json();
        
        // Update current comanda items
        currentComandaItems = comanda.itens;
        
        // Re-render products to update highlighting
        renderProdutos();
        
        const isFechada = comanda.status === 'fechada';
        
        document.getElementById('comanda-info').textContent = `Comanda #${comanda.numero} - ${comanda.cliente}`;
        
        if (document.getElementById('comanda-status-badge')) {
            const statusMap = {
                'aberta': { text: 'Aberta', class: 'bg-success-subtle text-success' },
                'aguardando_cozinha': { text: 'Cozinha', class: 'bg-warning-subtle text-warning' },
                'fechada': { text: 'Fechada', class: 'bg-danger-subtle text-danger' }
            };
            const s = statusMap[comanda.status] || { text: comanda.status, class: 'bg-secondary-subtle' };
            
            let statusHtml = s.text;
            if (comanda.status === 'aguardando_cozinha' && comanda.data_aguardando) {
                statusHtml += ` (<span class="timer-aguardando" data-start-time="${comanda.data_aguardando}">00:00</span>)`;
            }
            
            document.getElementById('comanda-status-badge').innerHTML = statusHtml;
            document.getElementById('comanda-status-badge').className = `badge ${s.class}`;
        }
        
        const itensContainer = document.getElementById('itens-comanda');
        itensContainer.innerHTML = '';
        
        let total = 0;
        comanda.itens.forEach(item => {
            total += item.subtotal;
            const entregueBadge = item.entregue && item.e_cozinha ? '<span class="badge badge-open">Entregue</span>' : '';
            
            // Botão de remover só aparece se não estiver fechada
            const removeBtn = !isFechada ? `
                <button class="mt-1 text-xs text-rose-500 hover:text-rose-600 font-medium" onclick="removeItem(${item.id})">Remover</button>
            ` : '';

            itensContainer.innerHTML += `
                <div class="item-comanda flex justify-between items-start gap-3">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center flex-wrap gap-1">
                            <span class="font-bold text-amber-700">${item.quantidade}x</span>
                            <span class="font-medium text-stone-800">${item.produto_nome}</span>
                            ${entregueBadge}
                        </div>
                        ${item.observacao ? `<p class="text-sm text-stone-500 mt-0.5 italic">${item.observacao}</p>` : ''}
                    </div>
                    <div class="text-right shrink-0">
                        <div class="font-semibold text-stone-800">R$ ${item.subtotal.toFixed(2).replace('.', ',')}</div>
                        ${removeBtn}
                    </div>
                </div>
            `;
        });
        
        document.getElementById('total-comanda').textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
        
        // Bloquear botões de ação se estiver fechada
        const btnFechar = document.querySelector('button[onclick="fecharComanda()"]');
        const btnCozinha = document.querySelector('button[onclick="imprimirCozinha()"]');
        const inputObs = document.getElementById('observacao');
        
        if (isFechada) {
            if (btnFechar) btnFechar.disabled = true;
            if (btnCozinha) btnCozinha.disabled = true;
            if (inputObs) inputObs.disabled = true;
            // Desativa todos os botões de produtos
            document.querySelectorAll('.produto-btn').forEach(btn => btn.disabled = true);
        } else {
            if (btnFechar) btnFechar.disabled = false;
            if (btnCozinha) btnCozinha.disabled = false;
            if (inputObs) inputObs.disabled = false;
            document.querySelectorAll('.produto-btn').forEach(btn => btn.disabled = false);
        }
        
    } catch (error) {
        console.error('Erro ao carregar detalhes da comanda:', error);
    }
}

async function addItem(produtoId) {
    const observacao = document.getElementById('observacao').value.trim();
    
    try {
        const response = await fetch(`/api/comandas/${currentComandaId}/itens`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ produto_id: produtoId, quantidade: 1, observacao })
        });
        
        const data = await response.json();
        console.log('Resposta do backend ao adicionar item:', data);
        
        document.getElementById('observacao').value = '';
        loadComandaDetalhes();
        loadComandas();
    } catch (error) {
        console.error('Erro ao adicionar item:', error);
    }
}

async function removeItem(itemId) {
    if (!confirm('Remover este item?')) return;
    
    try {
        await fetch(`/api/comandas/${currentComandaId}/itens/${itemId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        loadComandaDetalhes();
        loadComandas();
    } catch (error) {
        console.error('Erro ao remover item:', error);
    }
}

let totalComanda = 0;

async function fecharComanda() {
    try {
        const response = await fetch(`/api/comandas/${currentComandaId}`, {
            headers: getHeaders()
        });
        const comanda = await response.json();
        totalComanda = comanda.total;
        
        document.getElementById('modal-total').textContent = `R$ ${totalComanda.toFixed(2).replace('.', ',')}`;
        document.getElementById('troco').textContent = 'R$ 0,00';
        document.getElementById('valor-pago').value = '';
        document.getElementById('valor-pago-container').style.display = 'none';
        document.getElementById('forma-pagamento').value = 'marcar';
        
        abrirModal('modalFechar');
        
    } catch (error) {
        console.error('Erro:', error);
    }
}

document.getElementById('forma-pagamento').addEventListener('change', function() {
    const container = document.getElementById('valor-pago-container');
    container.style.display = this.value === 'dinheiro' ? 'block' : 'none';
});

document.getElementById('valor-pago').addEventListener('input', function() {
    const valorPago = parseFloat(this.value) || 0;
    const troco = valorPago - totalComanda;
    document.getElementById('troco').textContent = `R$ ${Math.max(0, troco).toFixed(2).replace('.', ',')}`;
});

async function confirmarFechamento() {
    const formaPagamento = document.getElementById('forma-pagamento').value;
    
    try {
        const response = await fetch(`/api/comandas/${currentComandaId}/fechar`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ forma_pagamento: formaPagamento })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            alert(errorData.detail || 'Erro ao fechar pedido!');
            return;
        }
        
        const data = await response.json();
        
        fecharModal('modalFechar');
        
        // Em vez de alerta e fechar, mostra o resumo
        // await visualizarComanda(currentComandaId); // Removido para voltar direto
        
        // Volta para a tela inicial automaticamente
        showInicial();
        
    } catch (error) {
        console.error('Erro ao fechar comanda:', error);
        alert('Ocorreu um erro ao fechar o pedido!');
    }
}

async function visualizarComanda(id) {
    try {
        const response = await fetch(`/api/comandas/${id}`, {
            headers: getHeaders()
        });
        const comanda = await response.json();
        
        const corpo = document.getElementById('resumo-corpo');
        document.getElementById('modalResumoTitle').textContent = 'Resumo da Comanda';
        
        let html = `
            <div class="space-y-2 mb-4">
                <div class="flex justify-between"><span class="text-muted-foreground">Comanda:</span><span class="font-medium">#${comanda.numero}</span></div>
                <div class="flex justify-between"><span class="text-muted-foreground">Cliente:</span><span class="font-medium">${comanda.cliente}</span></div>
                <div class="flex justify-between"><span class="text-muted-foreground">Data:</span><span class="font-medium">${new Date(comanda.data_abertura).toLocaleString('pt-BR')}</span></div>
                <div class="flex justify-between"><span class="text-muted-foreground">Status:</span><span class="font-medium">${comanda.status.toUpperCase()}</span></div>
            </div>
            <div class="border-t border-border pt-4">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-b border-border">
                            <th class="text-left py-2 font-medium text-muted-foreground">Item</th>
                            <th class="text-right py-2 font-medium text-muted-foreground">Qtd</th>
                            <th class="text-right py-2 font-medium text-muted-foreground">Total</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        comanda.itens.forEach(item => {
            html += `
                <tr class="border-b border-border/50">
                    <td class="py-2">${item.produto_nome}</td>
                    <td class="text-right py-2">${item.quantidade}</td>
                    <td class="text-right py-2">R$ ${item.subtotal.toFixed(2).replace('.', ',')}</td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
            <div class="border-t border-border pt-4 mt-4">
                <div class="flex justify-between items-center">
                    <span class="text-lg font-semibold">Total:</span>
                    <span class="text-lg font-bold text-primary">R$ ${comanda.total.toFixed(2).replace('.', ',')}</span>
                </div>
                ${comanda.forma_pagamento ? `<p class="text-sm text-muted-foreground mt-2">Pagamento: ${comanda.forma_pagamento.toUpperCase()}</p>` : ''}
            </div>
        `;
        
        corpo.innerHTML = html;
        
        const btnImprimir = document.getElementById('btn-imprimir-resumo');
        btnImprimir.onclick = () => imprimirRecibo(comanda);
        
        abrirModal('modalResumo');
        
        // Se a comanda estiver fechada, recarrega a lista ao fechar o modal
        if (comanda.status === 'fechada') {
            const modal = document.getElementById('modalResumo');
            const closeHandler = () => {
                showInicial();
                modal.removeEventListener('click', closeHandler);
            };
            // Adiciona listener para quando o modal for fechado
            setTimeout(() => {
                const closeBtn = modal.querySelector('[onclick*="fecharModal"]');
                if (closeBtn) {
                    const originalOnclick = closeBtn.onclick;
                    closeBtn.onclick = function() {
                        if (originalOnclick) originalOnclick();
                        showInicial();
                    };
                }
            }, 100);
        }

    } catch (error) {
        console.error('Erro ao visualizar comanda:', error);
    }
}

async function visualizarCozinha(id) {
    try {
        const response = await fetch(`/api/comandas/${id}`, {
            headers: getHeaders()
        });
        const comanda = await response.json();
        
        const itensCozinha = comanda.itens.filter(item => item.e_cozinha && !item.entregue);
        
        if (itensCozinha.length === 0) {
            alert('Nenhum item pendente para a cozinha!');
            return;
        }

        const corpo = document.getElementById('resumo-corpo');
        document.getElementById('modalResumoTitle').textContent = 'Pedido para Cozinha';
        
        let html = `
            <div class="space-y-2 mb-4">
                <div class="flex justify-between"><span class="text-muted-foreground">Comanda:</span><span class="font-medium">#${comanda.numero}</span></div>
                <div class="flex justify-between"><span class="text-muted-foreground">Cliente:</span><span class="font-medium">${comanda.cliente}</span></div>
            </div>
            <div class="border-t border-border pt-4">
                <h4 class="font-semibold mb-3">Itens para Producao:</h4>
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-b border-border">
                            <th class="text-left py-2 font-medium text-muted-foreground">Item</th>
                            <th class="text-right py-2 font-medium text-muted-foreground">Qtd</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        itensCozinha.forEach(item => {
            html += `
                <tr class="border-b border-border/50">
                    <td class="py-2">
                        ${item.produto_nome}
                        ${item.observacao ? `<br><span class="text-sm text-muted-foreground">→ ${item.observacao}</span>` : ''}
                    </td>
                    <td class="text-right py-2 font-medium">${item.quantidade}</td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        corpo.innerHTML = html;
        
        const btnImprimir = document.getElementById('btn-imprimir-resumo');
        btnImprimir.onclick = () => executarImpressaoCozinha(comanda);
        
        abrirModal('modalResumo');
    } catch (error) {
        console.error('Erro ao visualizar cozinha:', error);
    }
}

async function executarImpressaoCozinha(comanda) {
    try {
        const response = await fetch(`/api/comandas/${comanda.id}/imprimir-cozinha`, {
            method: 'POST',
            headers: getHeaders()
        });
        const data = await response.json();
        
        if (data.message.includes('não enviada')) {
            console.log('Impressão via rede falhou, abrindo diálogo do Windows...');
            await imprimirCozinhaNavegador(comanda);
        } else {
            alert('Impressão enviada para a cozinha!');
        }
    } catch (error) {
        console.error('Erro ao imprimir cozinha:', error);
        await imprimirCozinhaNavegador(comanda);
    }
}

async function imprimirRecibo(comanda) {
    try {
        // 1. Tenta imprimir via rede (servidor)
        const response = await fetch(`/api/comandas/${comanda.id}/imprimir-comanda`, {
            method: 'POST',
            headers: getHeaders()
        });
        const data = await response.json();
        
        if (data.message.includes('não enviada')) {
            // 2. Se falhar, abre o relatório do windows
            console.log('Impressão via rede falhou, abrindo diálogo do Windows...');
            await imprimirReciboNavegador(comanda);
        } else {
            alert('Impressão enviada para a impressora de rede!');
        }
        
    } catch (error) {
        console.error('Erro ao imprimir via servidor:', error);
        await imprimirReciboNavegador(comanda);
    }
}

async function imprimirReciboNavegador(comanda) {
    const largura = document.getElementById('largura-impressora').value;
    const printId = largura === '80' ? 'print-recibo-80' : 'print-recibo-58';
    
    document.getElementById(`recibo-numero-${largura}`).textContent = comanda.numero;
    document.getElementById(`recibo-cliente-${largura}`).textContent = comanda.cliente;
    
    const dataHora = new Date(comanda.data_abertura).toLocaleString('pt-BR');
    document.getElementById(`recibo-data-${largura}`).textContent = dataHora;
    
    const statusTraduzido = {
        "aberta": "ABERTA",
        "fechada": "FECHADA",
        "aguardando_cozinha": "AGUARDANDO COZINHA"
    }[comanda.status] || comanda.status.toUpperCase();
    document.getElementById(`recibo-status-${largura}`).textContent = statusTraduzido;
    
    let itensHtml = '';
    comanda.itens.forEach(item => {
        itensHtml += `
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px; font-size: inherit;">
                <div style="flex: 1; padding-right: 5px;">${item.produto_nome}</div>
                <div style="width: 30px; text-align: center;">${item.quantidade}</div>
                <div style="width: 75px; text-align: right;">R$ ${item.subtotal.toFixed(2).replace('.', ',')}</div>
            </div>
        `;
    });
    document.getElementById(`recibo-itens-${largura}`).innerHTML = itensHtml;
    document.getElementById(`recibo-total-${largura}`).textContent = comanda.total.toFixed(2).replace('.', ',');
    document.getElementById(`recibo-pagamento-${largura}`).textContent = comanda.forma_pagamento || 'N/A';
    
    const printContainer = document.getElementById(printId);
    printContainer.classList.add('active');
    printContainer.style.display = 'block';
    
    setTimeout(() => {
        window.print();
        setTimeout(() => {
            printContainer.classList.remove('active');
            printContainer.style.display = 'none';
        }, 1000);
    }, 500);
}

function showAdmin() {
    window.location.href = '/admin';
}

async function abrirAdminComSenha() {
    const role = sessionStorage.getItem('sys_role');
    const user = sessionStorage.getItem('sys_username');
    
    if (role === 'admin' || user === 'RTSYSTEM') {
        showAdmin();
        return;
    }

    const senha = prompt('Digite a senha para acessar o Painel Admin:');
    if (senha === null) return;

    try {
        const response = await fetch('/api/sistema/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, senha: senha })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.user.role === 'admin' || data.user.username === 'RTSYSTEM') {
                showAdmin();
            } else {
                alert('Seu usuário não tem permissão de administrador!');
            }
        } else {
            alert('Senha incorreta!');
        }
    } catch (e) {
        console.error(e);
        alert('Erro ao validar senha!');
    }
}

let comandaAtual = null;
let comandaFechada = null;

async function imprimirCozinha() {
    await visualizarCozinha(currentComandaId);
}

async function imprimirCozinhaNavegador(comanda) {
    try {
        const itensCozinha = comanda.itens.filter(item => item.e_cozinha && !item.entregue);
        
        if (itensCozinha.length === 0) {
            alert('Nenhum item de cozinha pendente nesta comanda!');
            return;
        }
        
        const largura = document.getElementById('largura-impressora').value;
        const printId = largura === '80' ? 'print-cozinha-80' : 'print-cozinha-58';
        
        document.getElementById(`print-cliente-${largura}`).textContent = comanda.cliente;
        document.getElementById(`print-numero-${largura}`).textContent = comanda.numero;
        
        const now = new Date();
        const hora = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        document.getElementById(`print-hora-${largura}`).textContent = hora;
        
        let itensHtml = '';
        itensCozinha.forEach(item => {
            itensHtml += `
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: inherit;">
                    <div style="flex: 1; padding-right: 5px;">
                        <strong>${item.produto_nome}</strong>
                        ${item.observacao ? `<div style="font-size: 0.9em; margin-left: 5px;">→ ${item.observacao}</div>` : ''}
                    </div>
                    <div style="width: 30px; text-align: right; font-weight: bold;">${item.quantidade}</div>
                </div>
            `;
        });
        document.getElementById(`print-itens-${largura}`).innerHTML = itensHtml;
        
        const printContainer = document.getElementById(printId);
        printContainer.classList.add('active');
        printContainer.style.display = 'block';
        
        setTimeout(() => {
            window.print();
            setTimeout(() => {
                printContainer.classList.remove('active');
                printContainer.style.display = 'none';
            }, 1000);
        }, 500);
        
    } catch (error) {
        console.error('Erro ao imprimir para cozinha:', error);
    }
}

async function imprimirComandaCompleta() {
    await visualizarComanda(currentComandaId);
}

async function imprimirComandaCompletaNavegador() {
    try {
        const response = await fetch(`/api/comandas/${currentComandaId}`);
        const comanda = await response.json();
        
        const largura = document.getElementById('largura-impressora').value;
        const printId = largura === '80' ? 'print-comanda-80' : 'print-comanda-58';
        
        document.getElementById(`comanda-aberta-numero-${largura}`).textContent = comanda.numero;
        document.getElementById(`comanda-aberta-cliente-${largura}`).textContent = comanda.cliente;
        
        const now = new Date();
        const dataHora = now.toLocaleString('pt-BR', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit', 
            minute: '2-digit' 
        });
        document.getElementById(`comanda-aberta-data-${largura}`).textContent = dataHora;
        
        let itensHtml = '';
        comanda.itens.forEach(item => {
            itensHtml += `
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px; font-size: inherit;">
                    <div style="flex: 1; padding-right: 5px;">${item.produto_nome}</div>
                    <div style="width: 30px; text-align: center;">${item.quantidade}</div>
                    <div style="width: 75px; text-align: right;">R$ ${item.subtotal.toFixed(2).replace('.', ',')}</div>
                </div>
            `;
        });
        document.getElementById(`comanda-aberta-itens-${largura}`).innerHTML = itensHtml;
        
        document.getElementById(`comanda-aberta-total-${largura}`).textContent = comanda.total.toFixed(2).replace('.', ',');
        
        const printContainer = document.getElementById(printId);
        printContainer.classList.add('active');
        printContainer.style.display = 'block';
        
        setTimeout(() => {
            window.print();
            setTimeout(() => {
                printContainer.classList.remove('active');
                printContainer.style.display = 'none';
            }, 1000);
        }, 500);
        
    } catch (error) {
        console.error('Erro ao imprimir comanda:', error);
        document.querySelectorAll('.print-container').forEach(el => {
            el.classList.remove('active');
            el.style.display = 'none';
        });
    }
}

async function loadConfigs() {
    try {
        const response = await fetch('/api/configs');
        if (response.ok) {
            const configs = await response.json();
            
            // Dados do estabelecimento na Home
            if (configs.nome_estabelecimento) {
                const homeNome = document.getElementById('home-nome-estabelecimento');
                if (homeNome) homeNome.textContent = configs.nome_estabelecimento;
                
                const navNome = document.getElementById('nav-nome-estabelecimento');
                if (navNome) navNome.textContent = configs.nome_estabelecimento;
            }
            
            if (configs.endereco_estabelecimento) {
                const homeEnd = document.getElementById('home-endereco-estabelecimento');
                if (homeEnd) homeEnd.textContent = configs.endereco_estabelecimento;
            }
        }
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
    }
}

// Funcoes para modais (substituem o Bootstrap)
function abrirModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.style.overflow = 'hidden';
    }
}

function fecharModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = '';
    }
}

// Fecha modal ao clicar fora dele
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay')) {
        const modals = document.querySelectorAll('.modal-overlay');
        modals.forEach(modal => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        });
        document.body.style.overflow = '';
    }
});
