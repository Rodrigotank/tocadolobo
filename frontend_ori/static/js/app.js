let currentComandaId = null;
let produtos = [];
let categorias = [];
let comandas = [];
let filtroAtual = 'abertas';

document.addEventListener('DOMContentLoaded', () => {
    // Verifica se já está logado na sessão atual
    if (sessionStorage.getItem('sys_logged_in') === 'true') {
        document.getElementById('lock-screen').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
    }

    loadProdutos();
    loadComandas();
    loadCategorias();
});

async function tentarLogin() {
    const senha = document.getElementById('sys-password').value;
    const erro = document.getElementById('login-error');
    
    try {
        const response = await fetch('/api/sistema/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senha: senha })
        });
        
        if (response.ok) {
            sessionStorage.setItem('sys_logged_in', 'true');
            document.getElementById('lock-screen').style.display = 'none';
            document.getElementById('main-content').style.display = 'block';
        } else {
            erro.style.display = 'block';
            setTimeout(() => erro.style.display = 'none', 3000);
        }
    } catch (e) {
        console.error(e);
        alert('Erro ao validar senha!');
    }
}

async function loadComandas() {
    try {
        const response = await fetch('/api/comandas');
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
    
    document.getElementById('btn-filtro-abertas').classList.remove('active');
    document.getElementById('btn-filtro-aguardando').classList.remove('active');
    document.getElementById('btn-filtro-fechadas').classList.remove('active');
    
    if (tipo === 'abertas') {
        document.getElementById('btn-filtro-abertas').classList.add('active');
    } else if (tipo === 'aguardando') {
        document.getElementById('btn-filtro-aguardando').classList.add('active');
    } else if (tipo === 'fechadas') {
        document.getElementById('btn-filtro-fechadas').classList.add('active');
    }
    
    aplicarFiltro();
}

async function loadProdutos() {
    try {
        const response = await fetch('/api/produtos');
        produtos = await response.json();
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
    }
}

async function loadCategorias() {
    try {
        const response = await fetch('/api/categorias');
        categorias = await response.json();
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
    }
}

function renderComandas(lista) {
    const container = document.getElementById('lista-comandas');
    container.innerHTML = '';

    lista.forEach(comanda => {
        let badgeClass = 'bg-success-subtle text-success border border-success-subtle';
        let statusText = 'Aberta';
        let statusKey = 'aberta';
        
        if (comanda.status === 'fechada') {
            badgeClass = 'bg-danger-subtle text-danger border border-danger-subtle';
            statusText = 'Fechada';
            statusKey = 'fechada';
        } else if (comanda.status === 'aguardando_cozinha') {
            badgeClass = 'bg-warning-subtle text-warning border border-warning-subtle';
            statusText = 'Aguardando';
            statusKey = 'aguardando';
        }

        const isMarcada = comanda.forma_pagamento === 'marcar';
        const marcadaBadge = isMarcada ? '<span class="badge bg-info-subtle text-info border border-info-subtle mb-1">Marcada</span>' : '';
        
        let btnEntregue = '';
        if (comanda.status === 'aguardando_cozinha') {
            btnEntregue = `
                <button class="btn btn-success w-100 mb-2 py-2" onclick="event.stopPropagation(); marcarEntregueLista(${comanda.id})">
                    <i class="bi bi-check2-circle me-1"></i> Entregue
                </button>
            `;
        }

        let btnVisualizar = '';
        if (comanda.status === 'fechada') {
            btnVisualizar = `
                <button class="btn btn-outline-primary w-100 mb-2 py-2" onclick="event.stopPropagation(); visualizarComanda(${comanda.id})">
                    <i class="bi bi-eye me-1"></i> Detalhes
                </button>
            `;
        }

        const isFechada = comanda.status === 'fechada';
        const clickAction = isFechada ? `visualizarComanda(${comanda.id})` : `openComanda(${comanda.id})`;

        const card = `
            <div class="col-md-4 col-lg-3 mb-4">
                <div class="card comanda-card status-${statusKey} ${isFechada ? 'opacity-75' : ''}" onclick="${clickAction}" style="cursor: pointer;">
                    <div class="status-indicator"></div>
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <div>
                                <h5 class="card-title mb-0">#${comanda.numero}</h5>
                                <div class="text-muted small mt-1">
                                    <i class="bi bi-clock me-1"></i> ${new Date(comanda.data_abertura).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                                </div>
                            </div>
                            <div class="d-flex flex-column align-items-end gap-1">
                                <span class="badge ${badgeClass}">${statusText}</span>
                                ${marcadaBadge}
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <div class="d-flex align-items-center mb-1">
                                <i class="bi bi-person text-primary me-2"></i>
                                <span class="fw-bold">${comanda.cliente}</span>
                            </div>
                            ${comanda.mesa ? `
                            <div class="d-flex align-items-center text-muted small">
                                <i class="bi bi-geo-alt me-2"></i>
                                <span>Mesa: ${comanda.mesa}</span>
                            </div>` : ''}
                        </div>

                        <div class="d-flex justify-content-between align-items-center pt-3 border-top">
                            <span class="text-muted small">Total</span>
                            <span class="fs-5 fw-bold text-primary">R$ ${comanda.total.toFixed(2).replace('.', ',')}</span>
                        </div>
                        
                        ${btnEntregue ? `<div class="mt-3">${btnEntregue}</div>` : ''}
                        ${btnVisualizar ? `<div class="mt-3">${btnVisualizar}</div>` : ''}
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += card;
    });
}

async function marcarEntregueLista(comandaId) {
    try {
        const response = await fetch(`/api/comandas/${comandaId}/entregar`, {
            method: 'POST'
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
    document.getElementById('tela-inicial').classList.remove('d-none');
    document.getElementById('tela-abrir-comanda').classList.add('d-none');
    document.getElementById('tela-pedidos').classList.add('d-none');
    loadComandas();
}

function showAbrirComanda() {
    document.getElementById('tela-inicial').classList.add('d-none');
    document.getElementById('tela-abrir-comanda').classList.remove('d-none');
    document.getElementById('tela-pedidos').classList.add('d-none');
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
            headers: { 'Content-Type': 'application/json' },
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
    try {
        const response = await fetch(`/api/comandas/${id}`);
        const comanda = await response.json();
        
        if (comanda.status === 'fechada') {
            visualizarComanda(id);
            return;
        }
        
        currentComandaId = id;
        
        document.getElementById('tela-inicial').classList.add('d-none');
        document.getElementById('tela-abrir-comanda').classList.add('d-none');
        document.getElementById('tela-pedidos').classList.remove('d-none');

        await loadProdutos();
        renderProdutos();
        await loadComandaDetalhes();
    } catch (error) {
        console.error('Erro ao abrir comanda:', error);
    }
}

function renderProdutos() {
    const container = document.getElementById('categorias-produtos');
    container.innerHTML = '';

    categorias.forEach(cat => {
        const produtosCategoria = produtos.filter(p => p.categoria_id === cat.id);
        if (produtosCategoria.length === 0) return;

        let html = `
            <div class="card categoria-card">
                <div class="card-header">${cat.nome}</div>
                <div class="card-body">
                    <div class="row g-2">
        `;

        produtosCategoria.forEach(prod => {
            html += `
                <div class="col-6 col-md-4 col-lg-3">
                    <button class="btn btn-outline-primary produto-btn w-100" onclick="addItem(${prod.id})">
                        <span>${prod.nome}</span>
                        <span class="preco">R$ ${prod.preco.toFixed(2).replace('.', ',')}</span>
                    </button>
                </div>
            `;
        });

        html += `
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

async function loadComandaDetalhes() {
    try {
        const response = await fetch(`/api/comandas/${currentComandaId}`);
        const comanda = await response.json();
        
        document.getElementById('comanda-info').textContent = `Comanda #${comanda.numero}`;
        if (document.getElementById('comanda-info-topo')) {
            document.getElementById('comanda-info-topo').textContent = `${comanda.mesa ? 'Mesa ' + comanda.mesa + ' - ' : ''}${comanda.cliente}`;
        }
        if (document.getElementById('comanda-status-badge')) {
            const statusMap = {
                'aberta': { text: 'Aberta', class: 'bg-success-subtle text-success' },
                'aguardando_cozinha': { text: 'Cozinha', class: 'bg-warning-subtle text-warning' },
                'fechada': { text: 'Fechada', class: 'bg-danger-subtle text-danger' }
            };
            const s = statusMap[comanda.status] || { text: comanda.status, class: 'bg-secondary-subtle' };
            document.getElementById('comanda-status-badge').textContent = s.text;
            document.getElementById('comanda-status-badge').className = `badge ${s.class}`;
        }
        
        const itensContainer = document.getElementById('itens-comanda');
        itensContainer.innerHTML = '';
        
        let total = 0;
        comanda.itens.forEach(item => {
            total += item.subtotal;
            const entregueBadge = item.entregue && item.e_cozinha ? '<i class="bi bi-check-all text-success ms-1" title="Entregue"></i>' : '';
            itensContainer.innerHTML += `
                <div class="item-comanda border-0 bg-light rounded-3 p-3 mb-2">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <div class="fw-bold text-dark">${item.quantidade}x ${item.produto_nome}${entregueBadge}</div>
                            ${item.observacao ? `<div class="small text-muted mt-1"><i class="bi bi-info-circle me-1"></i>${item.observacao}</div>` : ''}
                        </div>
                        <div class="text-end ms-2">
                            <div class="fw-bold text-primary">R$ ${item.subtotal.toFixed(2).replace('.', ',')}</div>
                            <button class="btn btn-sm text-danger p-0 mt-1" onclick="removeItem(${item.id})">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        document.getElementById('total-comanda').textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
        
    } catch (error) {
        console.error('Erro ao carregar detalhes da comanda:', error);
    }
}

async function addItem(produtoId) {
    const observacao = document.getElementById('observacao').value.trim();
    
    try {
        const response = await fetch(`/api/comandas/${currentComandaId}/itens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ produto_id: produtoId, quantidade: 1, observacao })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            alert(errorData.detail || 'Erro ao adicionar item!');
            return;
        }

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
        const response = await fetch(`/api/comandas/${currentComandaId}/itens/${itemId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json();
            alert(errorData.detail || 'Erro ao remover item!');
            return;
        }

        loadComandaDetalhes();
        loadComandas();
    } catch (error) {
        console.error('Erro ao remover item:', error);
    }
}

let totalComanda = 0;

async function fecharComanda() {
    try {
        const response = await fetch(`/api/comandas/${currentComandaId}`);
        const comanda = await response.json();
        totalComanda = comanda.total;
        
        document.getElementById('modal-total').textContent = `R$ ${totalComanda.toFixed(2).replace('.', ',')}`;
        document.getElementById('troco').textContent = 'R$ 0,00';
        document.getElementById('valor-pago').value = '';
        document.getElementById('valor-pago-container').style.display = 'none';
        document.getElementById('forma-pagamento').value = 'marcar';
        
        const modal = new bootstrap.Modal(document.getElementById('modalFechar'));
        modal.show();
        
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ forma_pagamento: formaPagamento })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            alert(errorData.detail || 'Erro ao fechar pedido!');
            return;
        }
        
        const data = await response.json();
        
        bootstrap.Modal.getInstance(document.getElementById('modalFechar')).hide();
        
        // Em vez de alerta e fechar, mostra o resumo
        await visualizarComanda(currentComandaId);
        
    } catch (error) {
        console.error('Erro ao fechar comanda:', error);
        alert('Ocorreu um erro ao fechar o pedido!');
    }
}

async function visualizarComanda(id) {
    try {
        const response = await fetch(`/api/comandas/${id}`);
        const comanda = await response.json();
        
        const corpo = document.getElementById('resumo-corpo');
        document.querySelector('#modalResumo .modal-title').textContent = 'Resumo da Comanda';
        
        let html = `
            <div class="mb-2"><strong>Comanda:</strong> #${comanda.numero}</div>
            <div class="mb-2"><strong>Cliente:</strong> ${comanda.cliente}</div>
            <div class="mb-2"><strong>Data:</strong> ${new Date(comanda.data_abertura).toLocaleString('pt-BR')}</div>
            <div class="mb-2"><strong>Status:</strong> ${comanda.status.toUpperCase()}</div>
            <hr>
            <table class="table table-sm">
                <thead>
                    <tr>
                        <th>Item</th>
                        <th class="text-end">Qtd</th>
                        <th class="text-end">Total</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        comanda.itens.forEach(item => {
            html += `
                <tr>
                    <td>${item.produto_nome}</td>
                    <td class="text-end">${item.quantidade}</td>
                    <td class="text-end">R$ ${item.subtotal.toFixed(2).replace('.', ',')}</td>
                </tr>
            `;
        });
        
        html += `
                </tbody>
            </table>
            <hr>
            <div class="d-flex justify-content-between">
                <h5>Total:</h5>
                <h5>R$ ${comanda.total.toFixed(2).replace('.', ',')}</h5>
            </div>
            ${comanda.forma_pagamento ? `<div class="mt-2 text-muted small">Pagamento: ${comanda.forma_pagamento.toUpperCase()}</div>` : ''}
        `;
        
        corpo.innerHTML = html;
        
        const btnImprimir = document.getElementById('btn-imprimir-resumo');
        btnImprimir.onclick = () => imprimirRecibo(comanda);
        
        const modal = new bootstrap.Modal(document.getElementById('modalResumo'));
        modal.show();
        
        // Se a comanda estiver fechada, recarrega a lista ao fechar o modal
        if (comanda.status === 'fechada') {
            document.getElementById('modalResumo').addEventListener('hidden.bs.modal', () => {
                showInicial();
            }, { once: true });
        }

    } catch (error) {
        console.error('Erro ao visualizar comanda:', error);
    }
}

async function visualizarCozinha(id) {
    try {
        const response = await fetch(`/api/comandas/${id}`);
        const comanda = await response.json();
        
        const itensCozinha = comanda.itens.filter(item => item.e_cozinha && !item.entregue);
        
        if (itensCozinha.length === 0) {
            alert('Nenhum item pendente para a cozinha!');
            return;
        }

        const corpo = document.getElementById('resumo-corpo');
        document.querySelector('#modalResumo .modal-title').textContent = 'Pedido para Cozinha';
        
        let html = `
            <div class="mb-2"><strong>Comanda:</strong> #${comanda.numero}</div>
            <div class="mb-2"><strong>Cliente:</strong> ${comanda.cliente}</div>
            <hr>
            <h6>Itens para Produção:</h6>
            <table class="table table-sm">
                <thead>
                    <tr>
                        <th>Item</th>
                        <th class="text-end">Qtd</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        itensCozinha.forEach(item => {
            html += `
                <tr>
                    <td>
                        ${item.produto_nome}
                        ${item.observacao ? `<br><small class="text-muted">→ ${item.observacao}</small>` : ''}
                    </td>
                    <td class="text-end">${item.quantidade}</td>
                </tr>
            `;
        });
        
        html += `
                </tbody>
            </table>
        `;
        
        corpo.innerHTML = html;
        
        const btnImprimir = document.getElementById('btn-imprimir-resumo');
        btnImprimir.onclick = () => executarImpressaoCozinha(comanda);
        
        const modal = new bootstrap.Modal(document.getElementById('modalResumo'));
        modal.show();
    } catch (error) {
        console.error('Erro ao visualizar cozinha:', error);
    }
}

async function executarImpressaoCozinha(comanda) {
    try {
        const response = await fetch(`/api/comandas/${comanda.id}/imprimir-cozinha`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.message.includes('não enviada')) {
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
            method: 'POST'
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

