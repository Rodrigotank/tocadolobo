// =============================================
// ADMIN.JS - Painel Administrativo
// =============================================

let produtos = [];
let categorias = [];
let comandas = [];
let produtoEditando = null;

// =============================================
// INICIALIZACAO
// =============================================

document.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('sys_logged_in') === 'true') {
        document.getElementById('lock-screen').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        iniciarPainelAdmin();
    } else {
        loadUsersLogin();
    }
});

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

function getHeaders() {
    return {
        'Content-Type': 'application/json',
        'X-User': sessionStorage.getItem('sys_username') || 'Sistema'
    };
}

function iniciarPainelAdmin() {
    loadProdutos();
    loadCategorias();
    loadMetricas();
    loadHistorico();
    loadEstoque();
    loadFechamentos();
    loadConfigs();
    loadConfigImpressora();
    loadUsuarios();
    loadSaudeSistema();
    loadESP32();
    // Atualiza lista de ESP32 a cada 10 segundos
    setInterval(loadESP32, 10000);
}

// =============================================
// AUTENTICACAO
// =============================================

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
            
            if (data.user.role !== 'admin' && data.user.username !== 'RTSYSTEM') {
                alert('Seu usuário não tem permissão de administrador!');
                return;
            }

            sessionStorage.setItem('sys_logged_in', 'true');
            sessionStorage.setItem('sys_username', data.user.username);
            sessionStorage.setItem('sys_role', data.user.role);
            
            document.getElementById('lock-screen').style.display = 'none';
            document.getElementById('main-content').style.display = 'block';
            iniciarPainelAdmin();
        } else {
            erro.classList.remove('hidden');
            setTimeout(() => erro.classList.add('hidden'), 3000);
        }
    } catch (e) {
        console.error(e);
        alert('Erro ao validar login!');
    }
}

// =============================================
// METRICAS
// =============================================

async function loadMetricas() {
    try {
        const [relResponse, comandasResponse] = await Promise.all([
            fetch('/api/relatorios/diario', { headers: getHeaders() }),
            fetch('/api/comandas', { headers: getHeaders() })
        ]);

        if (relResponse.ok) {
            const rel = await relResponse.json();
            document.getElementById('vendas-hoje').textContent = `R$ ${rel.total_vendas.toFixed(2).replace('.', ',')}`;
            document.getElementById('comandas-hoje').textContent = rel.quantidade_comandas;
        }

        if (comandasResponse.ok) {
            const lista = await comandasResponse.json();
            const abertas = lista.filter(c => c.status !== 'fechada').length;
            document.getElementById('comandas-abertas').textContent = abertas;
        }
    } catch (error) {
        console.error('Erro ao carregar metricas:', error);
    }
}

// =============================================
// PRODUTOS
// =============================================

async function loadProdutos() {
    try {
        const response = await fetch('/api/produtos', { headers: getHeaders() });
        produtos = await response.json();
        renderProdutos();
        populateSelectProdutos();
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
    }
}

async function loadCategorias() {
    try {
        const response = await fetch('/api/categorias', { headers: getHeaders() });
        categorias = await response.json();
        populateCategorias();
        renderCategorias();
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
    }
}

function populateCategorias() {
    const select = document.getElementById('categoria-produto');
    const selectLimpar = document.getElementById('select-categoria-limpar');
    const selectCardapio = document.getElementById('cardapio-select-produto');
    
    if (select) {
        select.innerHTML = '<option value="">Categoria</option>';
        categorias.forEach(cat => {
            select.innerHTML += `<option value="${cat.id}">${cat.nome}</option>`;
        });
    }

    if (selectLimpar) {
        selectLimpar.innerHTML = '<option value="">-- Escolha a Categoria --</option>';
        categorias.forEach(cat => {
            selectLimpar.innerHTML += `<option value="${cat.id}">${cat.nome}</option>`;
        });
    }

    if (selectCardapio) {
        selectCardapio.innerHTML = '<option value="">-- Selecione o Produto --</option>';
        // Organizar produtos por categoria no select
        categorias.forEach(cat => {
            const prodsDaCat = produtos.filter(p => p.categoria_id === cat.id);
            if (prodsDaCat.length > 0) {
                const group = document.createElement('optgroup');
                group.label = cat.nome.toUpperCase();
                prodsDaCat.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.id;
                    opt.textContent = p.nome;
                    group.appendChild(opt);
                });
                selectCardapio.appendChild(group);
            }
        });
    }
}

function populateSelectProdutos() {
    const select1 = document.getElementById('selecionar-produto');
    const select2 = document.getElementById('cardapio-select-produto');
    
    if (select1) {
        select1.innerHTML = '<option value="">-- Selecione um produto --</option>';
        produtos.forEach(prod => {
            select1.innerHTML += `<option value="${prod.id}">${prod.nome}</option>`;
        });
    }
    
    if (select2) {
        select2.innerHTML = '<option value="">-- Selecione o Produto --</option>';
        produtos.forEach(prod => {
            select2.innerHTML += `<option value="${prod.id}">${prod.nome}</option>`;
        });
    }
}

function renderProdutos() {
    const tbody = document.getElementById('lista-produtos');
    tbody.innerHTML = '';
    
    produtos.forEach(prod => {
        const categoria = categorias.find(c => c.id === prod.categoria_id);
        const catNome = categoria ? categoria.nome : '-';
        const cozinhaIcon = prod.e_cozinha 
            ? '<span class="inline-flex items-center justify-center w-6 h-6 bg-emerald-100 text-emerald-600 rounded-lg"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg></span>'
            : '<span class="inline-flex items-center justify-center w-6 h-6 bg-slate-100 text-slate-400 rounded-lg"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></span>';
        
        const estoqueClass = prod.estoque_atual <= prod.estoque_minimo ? 'text-rose-600 font-semibold' : 'text-slate-700';
        
        const imagemHtml = prod.imagem_url 
            ? `<img src="${prod.imagem_url}" alt="${prod.nome}" class="w-10 h-10 rounded-lg object-cover">`
            : '<svg class="w-10 h-10 text-slate-300 rounded-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>';
        
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-6 py-4">${imagemHtml}</td>
                <td class="px-6 py-4 font-medium text-slate-900">${prod.nome}</td>
                <td class="px-6 py-4 text-slate-600">${catNome}</td>
                <td class="px-6 py-4 text-slate-700 font-medium">R$ ${prod.preco.toFixed(2).replace('.', ',')}</td>
                <td class="px-6 py-4">${cozinhaIcon}</td>
                <td class="px-6 py-4 ${estoqueClass}">${Math.round(prod.estoque_atual)}</td>
                <td class="px-6 py-4">
                    <div class="flex gap-2">
                        <button onclick="editarProduto(${prod.id})" class="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm font-medium rounded-lg transition-all">Editar</button>
                        <button onclick="excluirProduto(${prod.id})" class="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-sm font-medium rounded-lg transition-all">Excluir</button>
                    </div>
                </td>
            </tr>
        `;
    });
}

function selecionarProdutoParaEditar() {
    const select = document.getElementById('selecionar-produto');
    const produtoId = parseInt(select.value);
    
    if (produtoId) {
        editarProduto(produtoId);
    }
}

function editarProduto(id) {
    const produto = produtos.find(p => p.id === id);
    if (!produto) return;
    
    produtoEditando = produto;
    
    document.getElementById('nome-produto').value = produto.nome;
    document.getElementById('preco-produto').value = produto.preco;
    document.getElementById('categoria-produto').value = produto.categoria_id;
    document.getElementById('estoque-produto').value = produto.estoque_atual;
    document.getElementById('minimo-produto').value = produto.estoque_minimo;
    document.getElementById('cozinha-produto').checked = produto.e_cozinha;
    document.getElementById('selecionar-produto').value = produto.id;
    
    if (document.getElementById('ean-produto')) document.getElementById('ean-produto').value = produto.ean || '';
    if (document.getElementById('imagem-produto')) document.getElementById('imagem-produto').value = produto.imagem_url || '';
    atualizarPreviewImagem();

    document.getElementById('form-title').textContent = 'Editar Produto';
    document.getElementById('btn-cancelar-produto').classList.remove('hidden');
}

function cancelarEdicao() {
    produtoEditando = null;
    limparFormulario();
    document.getElementById('form-title').textContent = 'Cadastrar Produto';
    document.getElementById('btn-cancelar-produto').classList.add('hidden');
    document.getElementById('selecionar-produto').value = '';
}

function atualizarPreviewImagem() {
    const url = document.getElementById('imagem-produto').value.trim();
    const container = document.getElementById('imagem-preview-container');
    
    if (url) {
        // Criar o elemento img programaticamente para evitar problemas de escape
        const img = document.createElement('img');
        img.src = url;
        img.className = 'w-full h-full object-cover';
        img.onerror = function() {
            container.innerHTML = '<svg class="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>';
        };
        container.innerHTML = '';
        container.appendChild(img);
    } else {
        container.innerHTML = '<svg class="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>';
    }
}

function limparFormulario() {
    document.getElementById('nome-produto').value = '';
    document.getElementById('preco-produto').value = '';
    document.getElementById('categoria-produto').value = '';
    document.getElementById('estoque-produto').value = '';
    document.getElementById('minimo-produto').value = '';
    document.getElementById('cozinha-produto').checked = false;
    if (document.getElementById('ean-produto')) document.getElementById('ean-produto').value = '';
    if (document.getElementById('imagem-produto')) document.getElementById('imagem-produto').value = '';
    atualizarPreviewImagem();
}

async function salvarProduto() {
    const nome = document.getElementById('nome-produto').value.trim();
    const preco = parseFloat(document.getElementById('preco-produto').value);
    const categoriaId = parseInt(document.getElementById('categoria-produto').value);
    const estoqueAtual = parseFloat(document.getElementById('estoque-produto').value) || 0;
    const estoqueMinimo = parseFloat(document.getElementById('minimo-produto').value) || 0;
    const eCozinha = document.getElementById('cozinha-produto').checked;
    const ean = document.getElementById('ean-produto') ? document.getElementById('ean-produto').value.trim() : null;
    const imagemUrl = document.getElementById('imagem-produto') ? document.getElementById('imagem-produto').value.trim() : null;
    
    if (!nome || isNaN(preco) || !categoriaId) {
        alert('Preencha todos os campos obrigatorios!');
        return;
    }
    
    const payload = {
        nome,
        preco,
        categoria_id: categoriaId,
        estoque_atual: estoqueAtual,
        estoque_minimo: estoqueMinimo,
        e_cozinha: eCozinha,
        ean: ean,
        imagem_url: imagemUrl
    };
    
    try {
        let response;
        if (produtoEditando) {
            response = await fetch(`/api/produtos/${produtoEditando.id}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });
        } else {
            response = await fetch('/api/produtos', {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });
        }
        
        if (response.ok) {
            alert(produtoEditando ? 'Produto atualizado!' : 'Produto cadastrado!');
            cancelarEdicao();
            loadProdutos();
        } else {
            alert('Erro ao salvar produto!');
        }
    } catch (error) {
        console.error('Erro ao salvar produto:', error);
        alert('Erro ao salvar produto!');
    }
}

async function excluirProduto(id) {
    if (!confirm('Deseja realmente excluir este produto?')) return;
    
    try {
        const response = await fetch(`/api/produtos/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        
        if (response.ok) {
            alert('Produto excluido!');
            loadProdutos();
        } else {
            alert('Erro ao excluir produto!');
        }
    } catch (error) {
        console.error('Erro ao excluir produto:', error);
    }
}

// =============================================
// HISTORICO
// =============================================

async function loadHistorico() {
    try {
        const response = await fetch('/api/comandas', { headers: getHeaders() });
        comandas = await response.json();
        renderHistorico(comandas);
    } catch (error) {
        console.error('Erro ao carregar historico:', error);
    }
}

let chartInstance = null;

function renderHistorico(lista) {
    const tbody = document.getElementById('historico-comandas');
    tbody.innerHTML = '';
    
    lista.forEach(comanda => {
        let statusBadge = '';
        if (comanda.status === 'fechada') {
            statusBadge = '<span class="px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">Fechada</span>';
        } else if (comanda.status === 'aguardando_cozinha') {
            statusBadge = '<span class="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">Aguardando</span>';
        } else {
            statusBadge = '<span class="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">Aberta</span>';
        }
        
        const data = new Date(comanda.data_abertura).toLocaleString('pt-BR');
        
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-6 py-4 font-semibold text-slate-900">#${comanda.numero}</td>
                <td class="px-6 py-4 text-slate-700">${comanda.cliente}</td>
                <td class="px-6 py-4 text-slate-600">${data}</td>
                <td class="px-6 py-4 font-medium text-slate-900">R$ ${comanda.total.toFixed(2).replace('.', ',')}</td>
                <td class="px-6 py-4">${statusBadge}</td>
                <td class="px-6 py-4">
                    <button onclick="visualizarComandaAdmin(${comanda.id})" class="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm font-medium rounded-lg transition-all">Ver</button>
                </td>
            </tr>
        `;
    });
    
    atualizarRanking(lista);
}

async function visualizarComandaAdmin(id) {
    try {
        const response = await fetch(`/api/comandas/${id}`, { headers: getHeaders() });
        const comanda = await response.json();
        
        let itensHtml = '';
        comanda.itens.forEach(item => {
            itensHtml += `
                <div class="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                    <div>
                        <span class="font-bold text-slate-800">${item.quantidade}x</span> 
                        <span class="text-slate-600">${item.produto_nome}</span>
                        ${item.observacao ? `<p class="text-xs text-slate-400 mt-0.5 italic">Obs: ${item.observacao}</p>` : ''}
                    </div>
                    <span class="font-medium text-slate-700">R$ ${item.subtotal.toFixed(2).replace('.', ',')}</span>
                </div>
            `;
        });
        
        const modalHtml = `
            <div id="modal-ver-comanda" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                    <div class="px-6 py-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h3 class="text-lg font-bold text-slate-800">Comanda #${comanda.numero}</h3>
                            <p class="text-xs text-slate-500">${new Date(comanda.data_abertura).toLocaleString('pt-BR')}</p>
                        </div>
                        <button onclick="this.closest('#modal-ver-comanda').remove()" class="text-slate-400 hover:text-slate-600">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                    <div class="p-6">
                        <div class="mb-4">
                            <p class="text-sm text-slate-500 mb-1">Cliente</p>
                            <p class="font-bold text-slate-800">${comanda.cliente}</p>
                            ${comanda.mesa ? `<p class="text-xs text-slate-500 mt-1">Mesa: ${comanda.mesa}</p>` : ''}
                        </div>
                        <div class="mb-6">
                            <p class="text-sm text-slate-500 mb-3">Itens do Pedido</p>
                            <div class="max-height-[300px] overflow-y-auto">
                                ${itensHtml}
                            </div>
                        </div>
                        <div class="pt-4 border-t border-slate-100 flex justify-between items-center">
                            <div>
                                <p class="text-sm text-slate-500">Forma de Pagamento</p>
                                <p class="font-semibold text-slate-700 uppercase">${comanda.forma_pagamento || 'N/A'}</p>
                            </div>
                            <div class="text-right">
                                <p class="text-sm text-slate-500">Total Pago</p>
                                <p class="text-2xl font-black text-blue-600">R$ ${comanda.total.toFixed(2).replace('.', ',')}</p>
                            </div>
                        </div>
                    </div>
                    <div class="px-6 py-4 bg-slate-50 flex gap-3">
                        <button onclick="imprimirComandaAdmin(${comanda.id})" class="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20">Imprimir</button>
                        <button onclick="this.closest('#modal-ver-comanda').remove()" class="flex-1 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl">Fechar</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao carregar detalhes da comanda.');
    }
}

async function imprimirComandaAdmin(id) {
    try {
        const response = await fetch(`/api/comandas/${id}`, { headers: getHeaders() });
        const comanda = await response.json();

        // 1. Tenta imprimir via rede
        const printResp = await fetch(`/api/comandas/${id}/imprimir-comanda`, {
            method: 'POST',
            headers: getHeaders()
        });
        const printData = await printResp.json();

        if (printData.message.includes('não enviada')) {
            console.log('Impressão via rede falhou, abrindo diálogo do Windows...');
            await imprimirComandaNavegador(comanda);
        } else {
            alert(printData.message);
        }
    } catch (error) {
        console.error('Erro ao imprimir:', error);
        alert('Erro ao enviar para impressora.');
    }
}

async function imprimirComandaNavegador(comanda) {
    // Reutilizar a lógica de app.js para imprimir no navegador
    // Como app.js não está carregado no admin.html, precisamos garantir os containers de impressão
    // ou redirecionar para uma função comum.
    // Para simplificar, vamos chamar a função de impressão do navegador se os elementos existirem
    
    // No admin.html, precisamos dos containers de impressão.
    // Vamos adicionar os containers de impressão ao admin.html para consistência
    
    // Fallback simples para o admin se os containers não existirem:
    window.print();
}

function filtrarHistorico() {
    const termo = document.getElementById('busca-historico').value.toLowerCase();
    const dataInicial = document.getElementById('data-inicial').value;
    const dataFinal = document.getElementById('data-final').value;
    
    let filtradas = comandas;
    
    if (termo) {
        filtradas = filtradas.filter(c => 
            c.numero.toString().includes(termo) || 
            c.cliente.toLowerCase().includes(termo)
        );
    }
    
    if (dataInicial) {
        // Criar data local a partir do input YYYY-MM-DD
        const [ano, mes, dia] = dataInicial.split('-').map(Number);
        const dIni = new Date(ano, mes - 1, dia, 0, 0, 0);
        filtradas = filtradas.filter(c => new Date(c.data_abertura) >= dIni);
    }
    
    if (dataFinal) {
        const [ano, mes, dia] = dataFinal.split('-').map(Number);
        const dFim = new Date(ano, mes - 1, dia, 23, 59, 59);
        filtradas = filtradas.filter(c => new Date(c.data_abertura) <= dFim);
    }
    
    renderHistorico(filtradas);
}

function limparFiltroHistorico() {
    document.getElementById('data-inicial').value = '';
    document.getElementById('data-final').value = '';
    document.getElementById('busca-historico').value = '';
    renderHistorico(comandas);
}

function filtrarHoje() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    const dataFormatada = `${ano}-${mes}-${dia}`;
    
    document.getElementById('data-inicial').value = dataFormatada;
    document.getElementById('data-final').value = dataFormatada;
    filtrarHistorico();
}

function atualizarRanking(lista) {
    const rankingContainer = document.getElementById('ranking-container');
    const rankingList = document.getElementById('ranking-list');
    
    if (lista.length === 0) {
        rankingContainer.classList.add('hidden');
        return;
    }
    
    rankingContainer.classList.remove('hidden');
    
    // Contabilizar itens (somente de comandas fechadas)
    const itensContagem = {};
    const fechadas = lista.filter(c => c.status === 'fechada');
    
    // Para obter os itens detalhados, precisaríamos de uma rota de API que retornasse os itens por período.
    // Como a lista de comandas da rota `/api/comandas` não inclui os itens detalhados por padrão (apenas resumo),
    // vamos buscar os itens das comandas filtradas.
    // Nota: Para performance, o ideal seria uma rota backend `/api/relatorios/ranking`.
    // Por enquanto, vamos buscar os itens das comandas da lista se houver poucos, ou mostrar mensagem.
    
    if (fechadas.length > 0) {
        buscarItensParaRanking(fechadas);
    } else {
        rankingContainer.classList.add('hidden');
    }
}

async function buscarItensParaRanking(comandasFechadas) {
    const itensContagem = {};
    
    // Devido à limitação de performance de buscar uma por uma, 
    // vamos usar a rota de relatório de período se as datas estiverem definidas
    const dataIni = document.getElementById('data-inicial').value;
    const dataFim = document.getElementById('data-final').value || dataIni;
    const busca = document.getElementById('busca-historico').value.trim();
    
    if (dataIni) {
        try {
            let url = `/api/relatorios/periodo?data_inicio=${dataIni}&data_fim=${dataFim}`;
            if (busca) {
                url += `&busca=${encodeURIComponent(busca)}`;
            }
            
            const response = await fetch(url, { headers: getHeaders() });
            if (response.ok) {
                const data = await response.json();
                renderRankingData(data.itens);
                return;
            }
        } catch (e) {
            console.error('Erro ao buscar ranking:', e);
        }
    }
    
    // Fallback: se não tiver data, não mostra o ranking por enquanto para evitar sobrecarga
    document.getElementById('ranking-container').classList.add('hidden');
}

function renderRankingData(itens) {
    const rankingList = document.getElementById('ranking-list');
    rankingList.innerHTML = '';
    
    // Ordenar por quantidade
    const sorted = itens.sort((a, b) => b.quantidade - a.quantidade).slice(0, 5);
    
    if (sorted.length === 0) {
        document.getElementById('ranking-container').classList.add('hidden');
        return;
    }

    sorted.forEach((item, index) => {
        const perc = (item.quantidade / sorted[0].quantidade) * 100;
        rankingList.innerHTML += `
            <div>
                <div class="flex justify-between text-sm mb-1">
                    <span class="font-semibold text-slate-700">${index + 1}. ${item.nome}</span>
                    <span class="text-slate-500">${item.quantidade} vendidos</span>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-2">
                    <div class="bg-blue-500 h-2 rounded-full" style="width: ${perc}%"></div>
                </div>
            </div>
        `;
    });
    
    // Gráfico
    const ctx = document.getElementById('rankingChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sorted.map(i => i.nome),
            datasets: [{
                data: sorted.map(i => i.quantidade),
                backgroundColor: [
                    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15 } }
            },
            cutout: '70%'
        }
    });
}

async function imprimirResumoDia() {
    const dataIni = document.getElementById('data-inicial').value;
    const dataFim = document.getElementById('data-final').value || dataIni;
    const busca = document.getElementById('busca-historico').value.trim();
    
    if (!dataIni) {
        alert('Selecione pelo menos uma data para visualizar o relatório!');
        return;
    }
    
    try {
        let url = `/api/relatorios/periodo?data_inicio=${dataIni}&data_fim=${dataFim}`;
        if (busca) {
            url += `&busca=${encodeURIComponent(busca)}`;
        }
        
        const response = await fetch(url, { headers: getHeaders() });
        if (response.ok) {
            const data = await response.json();
            visualizarRelatorioPeriodo(data);
        } else {
            alert('Erro ao buscar dados para o relatório.');
        }
    } catch (e) {
        console.error(e);
        alert('Erro ao processar o relatório.');
    }
}

function formatarDataBR(dataISO) {
    if (!dataISO) return '';
    const partes = dataISO.split('-');
    if (partes.length !== 3) return dataISO;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function visualizarRelatorioPeriodo(data) {
    let itensHtml = '';
    data.itens.forEach(item => {
        itensHtml += `
            <div class="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                <span class="text-slate-600">${item.nome}</span>
                <div class="text-right">
                    <span class="font-bold text-slate-800">${item.quantidade}x</span>
                    <p class="text-xs text-slate-400">R$ ${item.total.toFixed(2).replace('.', ',')}</p>
                </div>
            </div>
        `;
    });

    const modalHtml = `
        <div id="modal-relatorio-periodo" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                <div class="px-6 py-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <h3 class="text-lg font-bold text-slate-800">Relatório de Período</h3>
                    <button onclick="this.closest('#modal-relatorio-periodo').remove()" class="text-slate-400 hover:text-slate-600">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                <div class="p-6">
                    <div class="grid grid-cols-2 gap-4 mb-6">
                        <div>
                            <p class="text-xs text-slate-500 uppercase">De</p>
                            <p class="text-sm font-semibold">${formatarDataBR(data.data_inicio)}</p>
                        </div>
                        <div>
                            <p class="text-xs text-slate-500 uppercase">Até</p>
                            <p class="text-sm font-semibold">${formatarDataBR(data.data_fim)}</p>
                        </div>
                    </div>
                    <div class="mb-6">
                        <div class="flex justify-between items-center mb-3">
                            <h4 class="text-sm font-bold text-slate-700">Resumo de Vendas</h4>
                            <span class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">${data.quantidade_comandas} Comandas</span>
                        </div>
                        <div class="max-h-[300px] overflow-y-auto pr-2">
                            ${itensHtml || '<p class="text-center text-slate-400 py-4">Nenhum item vendido no período.</p>'}
                        </div>
                    </div>
                    <div class="pt-4 border-t border-slate-100 text-right">
                        <p class="text-sm text-slate-500">Total no Período</p>
                        <p class="text-3xl font-black text-blue-600">R$ ${data.total_lucrado.toFixed(2).replace('.', ',')}</p>
                    </div>
                </div>
                <div class="px-6 py-4 bg-slate-50 flex gap-3">
                    <button id="btn-executar-print-relatorio" class="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20">Imprimir</button>
                    <button onclick="this.closest('#modal-relatorio-periodo').remove()" class="flex-1 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl">Fechar</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btn-executar-print-relatorio').onclick = async () => {
        try {
            // 1. Tenta imprimir via rede
            const printResp = await fetch('/api/relatorios/periodo/imprimir', {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(data)
            });
            
            const printData = await printResp.json();
            
            if (printData.message.includes('não enviada')) {
                console.log('Impressão via rede falhou, abrindo diálogo do Windows...');
                await imprimirRelatorioPeriodoNavegador(data);
            } else {
                alert(printData.message);
            }
        } catch (e) {
            console.error(e);
            alert('Erro ao processar impressão.');
        }
    };
}

async function imprimirRelatorioPeriodoNavegador(data) {
    const printContainer = document.getElementById('print-resumo-dia');
    const conteudo = document.getElementById('print-resumo-conteudo');
    
    let itensHtml = '<table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
    itensHtml += '<tr style="border-bottom: 1px solid #000;"><th style="text-align: left;">Item</th><th style="text-align: right;">Qtd</th><th style="text-align: right;">Total</th></tr>';
    
    data.itens.forEach(item => {
        itensHtml += `<tr><td>${item.nome}</td><td style="text-align: right;">${item.quantidade}</td><td style="text-align: right;">R$ ${item.total.toFixed(2).replace('.', ',')}</td></tr>`;
    });
    itensHtml += '</table>';

    conteudo.innerHTML = `
        <div style="margin-bottom: 10px; text-align: center; font-weight: bold;">RELATÓRIO DE PERÍODO</div>
        <div style="margin-bottom: 10px;">
            <p><strong>De:</strong> ${formatarDataBR(data.data_inicio)}</p>
            <p><strong>Até:</strong> ${formatarDataBR(data.data_fim)}</p>
            <p><strong>Comandas:</strong> ${data.quantidade_comandas}</p>
        </div>
        ${itensHtml}
        <div style="margin-top: 10px; border-top: 1px solid #000; padding-top: 5px; text-align: right;">
            <p style="font-size: 16px;"><strong>Total: R$ ${data.total_lucrado.toFixed(2).replace('.', ',')}</strong></p>
        </div>
    `;

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

// =============================================
// ESTOQUE
// =============================================

async function loadEstoque() {
    try {
        const response = await fetch('/api/produtos', { headers: getHeaders() });
        const prods = await response.json();
        renderEstoque(prods);
    } catch (error) {
        console.error('Erro ao carregar estoque:', error);
    }
}

function renderEstoque(lista) {
    const tbody = document.getElementById('tabela-estoque');
    tbody.innerHTML = '';
    
    lista.forEach(prod => {
        let statusBadge = '';
        if (prod.estoque_atual <= 0) {
            statusBadge = '<span class="px-2.5 py-1 text-xs font-medium rounded-full bg-rose-100 text-rose-700">Sem Estoque</span>';
        } else if (prod.estoque_atual <= prod.estoque_minimo) {
            statusBadge = '<span class="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">Baixo</span>';
        } else {
            statusBadge = '<span class="px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">OK</span>';
        }
        
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-6 py-4 font-medium text-slate-900">${prod.nome}</td>
                <td class="px-6 py-4 text-slate-700">${Math.round(prod.estoque_atual)}</td>
                <td class="px-6 py-4 text-slate-600">${Math.round(prod.estoque_minimo)}</td>
                <td class="px-6 py-4">${statusBadge}</td>
                <td class="px-6 py-4">
                    <button onclick="ajustarEstoque(${prod.id})" class="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm font-medium rounded-lg transition-all">Ajustar</button>
                </td>
            </tr>
        `;
    });
}

async function ajustarEstoque(id) {
    const novoEstoque = prompt('Digite o novo valor do estoque:');
    if (novoEstoque === null) return;
    
    const valor = parseFloat(novoEstoque);
    if (isNaN(valor)) {
        alert('Valor invalido!');
        return;
    }
    
    try {
        const response = await fetch('/api/estoque/ajuste', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ produto_id: id, quantidade: valor, tipo: 'balanco' })
        });
        
        if (response.ok) {
            alert('Estoque atualizado!');
            loadEstoque();
            loadProdutos();
        } else {
            alert('Erro ao atualizar estoque!');
        }
    } catch (error) {
        console.error('Erro:', error);
    }
}

// =============================================
// FECHAMENTOS
// =============================================

async function loadSaudeSistema() {
    try {
        const response = await fetch('/api/sistema/saude', { headers: getHeaders() });
        if (response.ok) {
            const data = await response.json();
            document.getElementById('saude-db-size').textContent = `${data.db_size_mb} MB`;
            document.getElementById('saude-total-logs').textContent = data.total_logs;
            document.getElementById('saude-total-comandas').textContent = data.total_comandas;
            document.getElementById('saude-total-itens').textContent = data.total_itens;
            
            const btnLimpar = document.getElementById('btn-limpar-logs-antigos');
            if (data.logs_antigos > 0) {
                btnLimpar.classList.remove('hidden');
                btnLimpar.innerHTML = `
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    Limpar ${data.logs_antigos} Logs Antigos
                `;
            } else {
                btnLimpar.classList.add('hidden');
            }
        }
    } catch (error) {
        console.error('Erro ao carregar saúde do sistema:', error);
    }
}

async function otimizarBanco() {
    if (!confirm('A otimização irá reorganizar o banco de dados para melhorar a performance. Deseja continuar?')) return;
    
    try {
        const response = await fetch('/api/sistema/otimizar', {
            method: 'POST',
            headers: getHeaders()
        });
        
        if (response.ok) {
            alert('Banco de dados otimizado com sucesso!');
            loadSaudeSistema();
        } else {
            alert('Erro ao otimizar banco de dados.');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro de conexão ao tentar otimizar.');
    }
}

async function limparLogsAntigos() {
    if (!confirm('Deseja realmente remover todos os logs com mais de 6 meses? Esta ação não pode ser desfeita.')) return;
    
    try {
        const response = await fetch('/api/sistema/limpar-logs-antigos', {
            method: 'POST',
            headers: getHeaders()
        });
        
        if (response.ok) {
            const data = await response.json();
            alert(data.message);
            loadSaudeSistema();
            loadLogs();
        } else {
            alert('Erro ao limpar logs antigos.');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro de conexão ao tentar limpar logs.');
    }
}

async function loadFechamentos() {
    try {
        const response = await fetch('/api/fechamentos', { headers: getHeaders() });
        const data = await response.json();
        renderFechamentos(data);
    } catch (error) {
        console.error('Erro ao carregar fechamentos:', error);
    }
}

// =============================================
// CARDAPIO VIRTUAL
// =============================================

function carregarImagemProdutoCardapio(useInput = false) {
    const id = document.getElementById('cardapio-select-produto').value;
    const preview = document.getElementById('cardapio-preview-container');
    const inputUrl = document.getElementById('cardapio-imagem-url');
    const previewNome = document.getElementById('cardapio-preview-nome');
    
    if (!id) {
        preview.innerHTML = '<svg class="w-12 h-12 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>';
        inputUrl.value = '';
        previewNome.textContent = 'Nenhum produto selecionado';
        return;
    }
    
    const prod = produtos.find(p => p.id == id);
    if (prod) {
        previewNome.textContent = prod.nome;
        let urlParaMostrar;
        if (useInput) {
            // Se useInput for true (ex: após upload), usa o valor do campo
            urlParaMostrar = inputUrl.value.trim() || prod.imagem_url || '';
        } else {
            // Se useInput for false (ex: trocar produto no dropdown), usa a imagem do produto
            urlParaMostrar = prod.imagem_url || '';
            inputUrl.value = urlParaMostrar;
        }
        
        if (urlParaMostrar) {
            preview.innerHTML = `<img src="${urlParaMostrar}" class="w-full h-full object-cover" onerror="this.src='/static/img/placeholder.png'">`;
        } else {
            preview.innerHTML = '<svg class="w-12 h-12 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>';
        }
    }
}

function buscarImagemGoogle() {
    const id = document.getElementById('cardapio-select-produto').value;
    if (!id) return;
    const prod = produtos.find(p => p.id == id);
    if (prod) {
        const query = encodeURIComponent(prod.nome);
        window.open(`https://www.google.com/search?tbm=isch&q=${query}`, '_blank');
        alert('DICA: Clique com o botao direito na imagem no Google, selecione "Copiar endereco da imagem" e cole no campo Link da Imagem.');
    }
}

async function uploadImagemCardapio() {
    const fileInput = document.getElementById('cardapio-imagem-upload');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Selecione uma imagem primeiro!');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch('/api/upload/imagem', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const data = await response.json();
            document.getElementById('cardapio-imagem-url').value = data.url;
            carregarImagemProdutoCardapio(true);
            alert('Upload realizado com sucesso! Clique em "Salvar no Cardapio" para confirmar.');
        } else {
            const err = await response.json();
            alert('Erro no upload: ' + (err.detail || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao conectar com o servidor.');
    }
}

async function salvarImagemCardapio() {
    const id = document.getElementById('cardapio-select-produto').value;
    const url = document.getElementById('cardapio-imagem-url').value.trim();
    
    if (!id) {
        alert('Selecione um produto primeiro!');
        return;
    }

    try {
        const prod = produtos.find(p => p.id == id);
        // Enviamos todos os campos necessários para o PUT, incluindo a nova imagem
        const payload = {
            nome: prod.nome,
            preco: prod.preco,
            categoria_id: prod.categoria_id,
            e_cozinha: prod.e_cozinha || false,
            estoque_atual: prod.estoque_atual || 0,
            estoque_minimo: prod.estoque_minimo || 0,
            ean: prod.ean || null,
            fator_conversao: prod.fator_conversao || 1.0,
            imagem_url: url
        };
        
        const response = await fetch(`/api/produtos/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert('Imagem salva com sucesso!');
            await loadProdutos(); // Aguarda o recarregamento dos produtos
            carregarImagemProdutoCardapio(); // Atualiza preview imediatamente
        } else {
            const err = await response.json();
            alert('Erro ao salvar imagem: ' + (err.detail || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao conectar com o servidor.');
    }
}

async function loadFechamentos() {
    try {
        const response = await fetch('/api/fechamentos', { headers: getHeaders() });
        if (response.ok) {
            const fechamentos = await response.json();
            renderFechamentos(fechamentos);
        }
    } catch (error) {
        console.error('Erro ao carregar fechamentos:', error);
    }
}

function renderFechamentos(lista) {
    const tbody = document.getElementById('tabela-fechamentos');
    tbody.innerHTML = '';
    
    lista.forEach(f => {
        const inicio = new Date(f.data_inicio).toLocaleString('pt-BR');
        const fim = new Date(f.data_fim).toLocaleString('pt-BR');
        
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-6 py-4 text-slate-700">${inicio}</td>
                <td class="px-6 py-4 text-slate-700">${fim}</td>
                <td class="px-6 py-4 font-medium text-slate-900">R$ ${f.total_vendido.toFixed(2).replace('.', ',')}</td>
                <td class="px-6 py-4">
                    <div class="flex gap-2">
                        <button onclick="verDetalhesFechamento(${f.id})" class="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm font-medium rounded-lg transition-all">Detalhes</button>
                        <button onclick="imprimirFechamento(${f.id})" class="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 text-sm font-medium rounded-lg transition-all">Imprimir</button>
                    </div>
                </td>
            </tr>
        `;
    });
}

async function verDetalhesFechamento(id) {
    try {
        const response = await fetch(`/api/fechamentos/${id}`, { headers: getHeaders() });
        const f = await response.json();
        
        const dados = JSON.parse(f.dados_json);
        let itensHtml = '';
        
        for (const pid in dados) {
            const item = dados[pid];
            itensHtml += `
                <div class="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                    <span class="text-slate-600">${item.nome}</span>
                    <div class="text-right">
                        <span class="font-bold text-slate-800">${item.quantidade}x</span>
                        <p class="text-xs text-slate-400">R$ ${item.total.toFixed(2).replace('.', ',')}</p>
                    </div>
                </div>
            `;
        }
        
        const modalHtml = `
            <div id="modal-detalhes-fechamento" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                    <div class="px-6 py-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <h3 class="text-lg font-bold text-slate-800">Detalhes do Fechamento</h3>
                        <button onclick="this.closest('#modal-detalhes-fechamento').remove()" class="text-slate-400 hover:text-slate-600">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                    <div class="p-6">
                        <div class="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <p class="text-xs text-slate-500 uppercase">Inicio</p>
                                <p class="text-sm font-semibold">${new Date(f.data_inicio).toLocaleString('pt-BR')}</p>
                            </div>
                            <div>
                                <p class="text-xs text-slate-500 uppercase">Fim</p>
                                <p class="text-sm font-semibold">${new Date(f.data_fim).toLocaleString('pt-BR')}</p>
                            </div>
                        </div>
                        <div class="mb-6">
                            <h4 class="text-sm font-bold text-slate-700 mb-3">Resumo de Vendas</h4>
                            <div class="max-h-[300px] overflow-y-auto pr-2">
                                ${itensHtml}
                            </div>
                        </div>
                        <div class="pt-4 border-t border-slate-100 text-right">
                            <p class="text-sm text-slate-500">Total Vendido</p>
                            <p class="text-3xl font-black text-emerald-600">R$ ${f.total_vendido.toFixed(2).replace('.', ',')}</p>
                        </div>
                    </div>
                    <div class="px-6 py-4 bg-slate-50 flex gap-3">
                        <button onclick="imprimirFechamento(${f.id})" class="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl">Imprimir</button>
                        <button onclick="this.closest('#modal-detalhes-fechamento').remove()" class="flex-1 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl">Fechar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    } catch (e) {
        console.error(e);
        alert('Erro ao carregar detalhes.');
    }
}

async function imprimirFechamento(id) {
    try {
        const response = await fetch(`/api/fechamentos/${id}`, { headers: getHeaders() });
        const f = await response.json();

        // 1. Tenta imprimir via rede
        const printResp = await fetch(`/api/fechamentos/${id}/imprimir`, { 
            method: 'POST',
            headers: getHeaders()
        });
        const printData = await printResp.json();

        if (printData.message.includes('não enviada')) {
            console.log('Impressão via rede falhou, abrindo diálogo do Windows...');
            await imprimirFechamentoNavegador(f);
        } else {
            alert(printData.message);
        }
    } catch (e) {
        console.error(e);
        alert('Erro ao imprimir.');
    }
}

async function imprimirFechamentoNavegador(f) {
    // Implementar visualização de impressão para fechamento no navegador
    const printContainer = document.getElementById('print-resumo-dia');
    const conteudo = document.getElementById('print-resumo-conteudo');
    
    const dados = JSON.parse(f.dados_json);
    let itensHtml = '<table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
    itensHtml += '<tr style="border-bottom: 1px solid #000;"><th style="text-align: left;">Item</th><th style="text-align: right;">Qtd</th><th style="text-align: right;">Total</th></tr>';
    
    for (const pid in dados) {
        const item = dados[pid];
        itensHtml += `<tr><td>${item.nome}</td><td style="text-align: right;">${item.quantidade}</td><td style="text-align: right;">R$ ${item.total.toFixed(2).replace('.', ',')}</td></tr>`;
    }
    itensHtml += '</table>';

    conteudo.innerHTML = `
        <div style="margin-bottom: 10px;">
            <p><strong>Início:</strong> ${new Date(f.data_inicio).toLocaleString('pt-BR')}</p>
            <p><strong>Fim:</strong> ${new Date(f.data_fim).toLocaleString('pt-BR')}</p>
        </div>
        ${itensHtml}
        <div style="margin-top: 10px; border-top: 1px solid #000; padding-top: 5px; text-align: right;">
            <p style="font-size: 16px;"><strong>Total: R$ ${f.total_vendido.toFixed(2).replace('.', ',')}</strong></p>
        </div>
    `;

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

async function confirmarFechamentoCaixa() {
    if (!confirm('Deseja realizar o fechamento do caixa agora?')) return;
    
    try {
        const response = await fetch('/api/fechamentos/novo', {
            method: 'POST',
            headers: getHeaders()
        });
        
        if (response.ok) {
            const data = await response.json();
            alert(`Fechamento realizado!\nTotal: R$ ${data.total_vendido.toFixed(2).replace('.', ',')}`);
            loadFechamentos();
            loadMetricas();
        } else {
            const err = await response.json();
            alert(err.detail || 'Erro ao realizar fechamento!');
        }
    } catch (error) {
        console.error('Erro:', error);
    }
}

function gerarRelatorioPeriodo() {
    const inicio = document.getElementById('relatorio-data-inicio').value;
    const fim = document.getElementById('relatorio-data-fim').value;
    
    if (!inicio || !fim) {
        alert('Selecione as datas!');
        return;
    }
    
    // Simplesmente redireciona para a aba de histórico com as datas preenchidas
    document.getElementById('data-inicial').value = inicio;
    document.getElementById('data-final').value = fim;
    showTab('historico');
    filtrarHistorico();
}

// =============================================
// MANUTENCAO
// =============================================

let senhaManutencaoVerificada = false;

async function alterarMinhaSenha() {
    const username = sessionStorage.getItem('sys_username');
    const novaSenha = document.getElementById('minha-nova-senha').value;
    
    if (!novaSenha || novaSenha.length < 3) {
        alert('A senha deve ter pelo menos 3 caracteres!');
        return;
    }
    
    try {
        const response = await fetch(`/api/usuarios/${username}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ senha: novaSenha })
        });
        
        if (response.ok) {
            alert('Sua senha foi alterada com sucesso!');
            document.getElementById('minha-nova-senha').value = '';
        } else {
            const err = await response.json();
            alert(err.detail || 'Erro ao alterar sua senha!');
        }
    } catch (error) {
        console.error('Erro:', error);
    }
}

async function alterarSenha(chave, inputId) {
    const novaSenha = document.getElementById(inputId).value;
    
    if (!novaSenha || novaSenha.length < 4) {
        alert('A senha deve ter pelo menos 4 caracteres!');
        return;
    }
    
    try {
        const response = await fetch('/api/sistema/alterar-senha', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ chave: chave, nova_senha: novaSenha })
        });
        
        if (response.ok) {
            alert('Senha alterada com sucesso!');
            document.getElementById(inputId).value = '';
        } else {
            alert('Erro ao alterar senha!');
        }
    } catch (error) {
        console.error('Erro:', error);
    }
}

async function verificarSenhaManutencao(event) {
    event.preventDefault();
    event.stopPropagation();

    if (senhaManutencaoVerificada) {
        showTab('manutencao');
        loadBackups();
        loadUsuarios();
        loadLogs();
        return;
    }

    const senha = prompt('Digite a senha de manutencao:');
    if (!senha) return;

    try {
        const response = await fetch('/api/sistema/validar-senha', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ chave: 'senha_manutencao', nova_senha: senha })
        });

        if (response.ok) {
            senhaManutencaoVerificada = true;
            showTab('manutencao');
            loadBackups();
            loadUsuarios();
            loadLogs();
        } else {
            alert('Senha incorreta!');
        }
    } catch (e) {
        console.error(e);
        alert('Erro ao validar senha!');
    }
}

async function loadBackups() {
    try {
        const response = await fetch('/api/sistema/backups/listar', { headers: getHeaders() });
        if (response.ok) {
            const backups = await response.json();
            renderBackups(backups);
        }
    } catch (error) {
        console.error('Erro ao carregar backups:', error);
    }
}

function renderBackups(lista) {
    const tbody = document.getElementById('lista-backups');
    tbody.innerHTML = '';
    
    if (!lista || lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="px-3 py-4 text-center text-slate-500">Nenhum backup encontrado</td></tr>';
        return;
    }
    
    lista.forEach(backup => {
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-3 py-2 text-slate-700 text-xs">${backup.nome}</td>
                <td class="px-3 py-2 text-slate-600 text-xs">${backup.data}</td>
                <td class="px-3 py-2 text-slate-600 text-xs">${backup.tamanho}</td>
                <td class="px-3 py-2">
                    <button onclick="downloadBackup('${backup.nome}')" class="text-blue-600 hover:text-blue-700 text-xs font-medium">Baixar</button>
                </td>
            </tr>
        `;
    });
}

async function realizarBackup() {
    try {
        const response = await fetch('/api/sistema/backup', { headers: getHeaders() });
        if (!response.ok) throw new Error('Erro ao gerar backup');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_tocalobo_${new Date().toISOString().slice(0, 10)}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();

        alert('Backup realizado com sucesso!');
        loadBackups();
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao realizar backup!');
    }
}

function downloadBackup(nome) {
    window.location.href = `/api/sistema/backups/download/${encodeURIComponent(nome)}`;
}

async function confirmarZerarDados() {
    const confirmacao = prompt('Digite "ZERAR" para confirmar a exclusao de todos os dados de movimentacao:');
    
    if (confirmacao !== 'ZERAR') {
        alert('Operacao cancelada!');
        return;
    }
    
    try {
        const response = await fetch('/api/sistema/reset', {
            method: 'POST',
            headers: getHeaders()
        });
        
        if (response.ok) {
            alert('Dados de movimentacao zerados com sucesso!');
            loadHistorico();
            loadFechamentos();
            loadMetricas();
        } else {
            alert('Erro ao zerar dados!');
        }
    } catch (error) {
        console.error('Erro:', error);
    }
}

// =============================================
// CATEGORIAS
// =============================================

function renderCategorias() {
    const container = document.getElementById('lista-categorias');
    container.innerHTML = '';
    
    categorias.forEach(cat => {
        container.innerHTML += `
            <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <span class="font-medium text-slate-700">${cat.nome}</span>
                <button onclick="excluirCategoria(${cat.id})" class="text-rose-500 hover:text-rose-600 text-sm font-medium">Excluir</button>
            </div>
        `;
    });
}

async function adicionarCategoria() {
    const nome = document.getElementById('nova-categoria').value.trim();
    
    if (!nome) {
        alert('Digite o nome da categoria!');
        return;
    }
    
    try {
        const response = await fetch('/api/categorias', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ nome })
        });
        
        if (response.ok) {
            alert('Categoria adicionada!');
            document.getElementById('nova-categoria').value = '';
            loadCategorias();
        } else {
            alert('Erro ao adicionar categoria!');
        }
    } catch (error) {
        console.error('Erro:', error);
    }
}

async function excluirCategoria(id) {
    if (!confirm('Deseja excluir esta categoria?')) return;
    
    try {
        const response = await fetch(`/api/categorias/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        
        if (response.ok) {
            alert('Categoria excluida!');
            loadCategorias();
        } else {
            const err = await response.json().catch(() => ({}));
            alert(err.detail || 'Erro ao excluir categoria!');
        }
    } catch (error) {
        console.error('Erro:', error);
    }
}

// =============================================
// ESP32
// =============================================

async function loadESP32() {
    try {
        const response = await fetch('/api/esp32', { headers: getHeaders() });
        if (response.ok) {
            const dispositivos = await response.json();
            renderESP32(dispositivos);
        }
    } catch (error) {
        console.error('Erro ao carregar ESP32:', error);
    }
}

function renderESP32(lista) {
    const tbody = document.getElementById('lista-esp32');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (lista.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-12 text-center text-slate-400">
                    <p>Nenhum dispositivo ESP32 conectado ainda.
                </td>
            </tr>
        `;
        return;
    }
    
    lista.forEach(d => {
        const statusClass = d.status === 'online' ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50';
        const statusText = d.status === 'online' ? 'Online' : 'Offline';
        const ultimaComunicacao = d.ultima_comunicacao 
            ? new Date(d.ultima_comunicacao).toLocaleString('pt-BR')
            : 'Nunca';
        
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 text-slate-800 font-medium">${d.nome}</td>
                <td class="px-4 py-3 text-slate-600 text-xs">${d.mac_address}</td>
                <td class="px-4 py-3 text-slate-600 text-xs">${d.ip_local || '--'}</td>
                <td class="px-4 py-3 text-slate-600 text-xs">${d.impressora_ip}:${d.impressora_porta}</td>
                <td class="px-4 py-3">
                    <span class="px-3 py-1 rounded-full text-xs font-semibold ${statusClass}">${statusText}</span>
                </td>
                <td class="px-4 py-3 text-slate-500 text-xs">${ultimaComunicacao}</td>
                <td class="px-4 py-3">
                    <div class="flex gap-2">
                        <button onclick="editarESP32(${d.id})" class="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 text-xs font-medium rounded-lg transition-all">Editar</button>
                        <button onclick="excluirESP32(${d.id})" class="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-medium rounded-lg transition-all">Excluir</button>
                    </div>
                </td>
            </tr>
        `;
    });
}

function editarESP32(id) {
    fetch(`/api/esp32/${id}`, { headers: getHeaders() })
        .then(response => response.json())
        .then(d => {
            document.getElementById('esp32-id-editar').value = d.id;
            document.getElementById('esp32-nome-editar').value = d.nome;
            document.getElementById('esp32-impressora-ip-editar').value = d.impressora_ip;
            document.getElementById('esp32-impressora-porta-editar').value = d.impressora_porta;
            document.getElementById('esp32-intervalo-editar').value = d.intervalo_verificacao;
            document.getElementById('modal-editar-esp32').classList.remove('hidden');
        })
        .catch(error => {
            console.error('Erro:', error);
            alert('Erro ao carregar dispositivo!');
        });
}

function fecharModalESP32() {
    document.getElementById('modal-editar-esp32').classList.add('hidden');
}

async function salvarEdicaoESP32() {
    const id = document.getElementById('esp32-id-editar').value;
    const payload = {
        nome: document.getElementById('esp32-nome-editar').value,
        impressora_ip: document.getElementById('esp32-impressora-ip-editar').value,
        impressora_porta: parseInt(document.getElementById('esp32-impressora-porta-editar').value),
        intervalo_verificacao: parseInt(document.getElementById('esp32-intervalo-editar').value)
    };
    
    try {
        const response = await fetch(`/api/esp32/${id}/configuracoes`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            alert('Configurações salvas com sucesso!');
            fecharModalESP32();
            loadESP32();
        } else {
            const err = await response.json();
            alert('Erro ao salvar: ' + (err.detail || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao conectar com o servidor.');
    }
}

async function excluirESP32(id) {
    if (!confirm('Deseja excluir este dispositivo ESP32?')) return;
    
    try {
        const response = await fetch(`/api/esp32/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        
        if (response.ok) {
            alert('Dispositivo excluído!');
            loadESP32();
        } else {
            const err = await response.json().catch(() => ({}));
            alert(err.detail || 'Erro ao excluir dispositivo!');
        }
    } catch (error) {
        console.error('Erro:', error);
    }
}

// =============================================
// USUÁRIOS E LOGS
// =============================================

async function loadUsuarios() {
    try {
        const response = await fetch('/api/usuarios', { headers: getHeaders() });
        const users = await response.json();
        renderUsuarios(users);
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
    }
}

function renderUsuarios(users) {
    const tbody = document.getElementById('lista-usuarios-table');
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const isMaster = user.username === 'RTSYSTEM';
        const actions = isMaster ? '-' : `
            <button onclick="prepararEdicaoUsuario('${user.username}', '${user.role}')" class="text-blue-600 hover:text-blue-700 font-medium mr-2">Editar</button>
            <button onclick="excluirUsuario('${user.username}')" class="text-rose-600 hover:text-rose-700 font-medium">Excluir</button>
        `;
        
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50">
                <td class="px-3 py-2 text-slate-700 font-medium">${user.username}</td>
                <td class="px-3 py-2 text-slate-600 uppercase text-[10px]">${user.role}</td>
                <td class="px-3 py-2 text-right">${actions}</td>
            </tr>
        `;
    });
}

function prepararEdicaoUsuario(username, role) {
    document.getElementById('user-username').value = username;
    document.getElementById('user-role').value = role;
    document.getElementById('user-password').value = '';
    document.getElementById('user-username').readOnly = true;
}

async function salvarUsuario() {
    const username = document.getElementById('user-username').value.trim();
    const senha = document.getElementById('user-password').value.trim();
    const role = document.getElementById('user-role').value;
    const isEdit = document.getElementById('user-username').readOnly;

    if (!username || (!isEdit && !senha)) {
        alert('Preencha o nome de usuário e a senha!');
        return;
    }

    try {
        const method = isEdit ? 'PUT' : 'POST';
        const url = isEdit ? `/api/usuarios/${username}` : '/api/usuarios';
        
        const response = await fetch(url, {
            method: method,
            headers: getHeaders(),
            body: JSON.stringify({ username, senha, role })
        });

        if (response.ok) {
            alert(isEdit ? 'Usuário atualizado!' : 'Usuário criado!');
            document.getElementById('user-username').value = '';
            document.getElementById('user-password').value = '';
            document.getElementById('user-username').readOnly = false;
            loadUsuarios();
        } else {
            const err = await response.json();
            alert(err.detail || 'Erro ao salvar usuário');
        }
    } catch (error) {
        console.error('Erro:', error);
    }
}

async function excluirUsuario(username) {
    if (!confirm(`Deseja remover o usuário ${username}?`)) return;
    
    try {
        const response = await fetch(`/api/usuarios/${username}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        
        if (response.ok) {
            alert('Usuário removido!');
            loadUsuarios();
        } else {
            const err = await response.json();
            alert(err.detail || 'Erro ao remover usuário');
        }
    } catch (error) {
        console.error('Erro:', error);
    }
}

async function loadLogs() {
    const filtro = document.getElementById('filtro-log-usuario').value;
    try {
        let url = '/api/sistema/logs';
        if (filtro) url += `?usuario=${encodeURIComponent(filtro)}`;
        
        const response = await fetch(url, { headers: getHeaders() });
        const logs = await response.json();
        renderLogs(logs);
    } catch (error) {
        console.error('Erro ao carregar logs:', error);
    }
}

function renderLogs(logs) {
    const tbody = document.getElementById('tabela-logs');
    tbody.innerHTML = '';
    
    logs.forEach(log => {
        const data = new Date(log.data).toLocaleString('pt-BR');
        let corAcao = 'text-slate-600';
        if (log.acao === 'venda') corAcao = 'text-emerald-600';
        if (log.acao === 'cancelamento') corAcao = 'text-rose-600';
        if (log.acao === 'finalizacao') corAcao = 'text-blue-600';
        
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 border-b border-slate-50 last:border-0">
                <td class="px-4 py-3 text-slate-500 whitespace-nowrap">${data}</td>
                <td class="px-4 py-3 font-bold text-slate-700">${log.usuario}</td>
                <td class="px-4 py-3 font-semibold ${corAcao} uppercase">${log.acao}</td>
                <td class="px-4 py-3 text-slate-600">${log.descricao}</td>
            </tr>
        `;
    });
}

async function downloadLogsTXT() {
    const filtro = document.getElementById('filtro-log-usuario').value;
    try {
        let url = '/api/sistema/logs';
        if (filtro) url += `?usuario=${encodeURIComponent(filtro)}`;
        
        const response = await fetch(url, { headers: getHeaders() });
        const logs = await response.json();
        
        if (logs.length === 0) {
            alert('Não há logs para exportar.');
            return;
        }

        let conteudo = "LOG DE ATIVIDADES - TOCA DO LOBO\n";
        conteudo += `Exportado em: ${new Date().toLocaleString('pt-BR')}\n`;
        if (filtro) conteudo += `Filtro utilizador: ${filtro}\n`;
        conteudo += "------------------------------------------------------------\n\n";

        logs.forEach(log => {
            const data = new Date(log.data).toLocaleString('pt-BR');
            conteudo += `[${data}] USUÁRIO: ${log.usuario.padEnd(15)} AÇÃO: ${log.acao.toUpperCase().padEnd(15)} DESCRIÇÃO: ${log.descricao}\n`;
        });

        const blob = new Blob([conteudo], { type: 'text/plain' });
        const urlBlob = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlBlob;
        a.download = `logs_atividades_${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(urlBlob);
        a.remove();

    } catch (error) {
        console.error('Erro ao baixar logs:', error);
        alert('Erro ao gerar arquivo de logs.');
    }
}

async function apagarTodosLogs() {
    const confirmacao = prompt('Digite "APAGAR" para excluir todo o histórico de logs definitivamente:');
    if (confirmacao !== 'APAGAR') {
        if (confirmacao !== null) alert('Operação cancelada! Você precisa digitar APAGAR corretamente.');
        return;
    }

    try {
        const response = await fetch('/api/sistema/logs', {
            method: 'DELETE',
            headers: getHeaders()
        });
        
        if (response.ok) {
            alert('Histórico de logs apagado com sucesso!');
            loadLogs();
        } else {
            const err = await response.json();
            alert(err.detail || 'Erro ao apagar logs');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro de conexão ao apagar logs.');
    }
}

// =============================================
// IMPRESSORA
// =============================================

function atualizarCamposImpressora() {
    const tipo = document.getElementById('impressora-tipo').value;
    const ethernet = tipo === 'ethernet';
    const usb = tipo === 'usb';
    const esp32 = tipo === 'esp32';

    document.getElementById('campo-ip').classList.toggle('hidden', !ethernet);
    document.getElementById('campo-porta').classList.toggle('hidden', !ethernet);
    document.getElementById('campo-vendor').classList.toggle('hidden', !usb);
    document.getElementById('campo-product').classList.toggle('hidden', !usb);
    document.getElementById('campo-esp32-ip').classList.toggle('hidden', !esp32);
    document.getElementById('campo-esp32-porta').classList.toggle('hidden', !esp32);
}

async function loadConfigImpressora() {
    try {
        const response = await fetch('/api/impressora/config', { headers: getHeaders() });
        const config = await response.json();

        document.getElementById('impressora-ativada').checked = config.ativada;
        document.getElementById('impressora-tipo').value = config.tipo || 'ethernet';
        document.getElementById('impressora-ip').value = config.ip || '192.168.88.29';
        document.getElementById('impressora-porta').value = config.porta || 9100;
        document.getElementById('impressora-vendor-id').value = config.usb_vendor_id
            ? '0x' + config.usb_vendor_id.toString(16).toUpperCase()
            : '';
        document.getElementById('impressora-product-id').value = config.usb_product_id
            ? '0x' + config.usb_product_id.toString(16).toUpperCase()
            : '';
        document.getElementById('impressora-largura').value = config.largura || 80;
        document.getElementById('impressora-esp32-ip').value = config.esp32_impressora_ip || '192.168.88.29';
        document.getElementById('impressora-esp32-porta').value = config.esp32_impressora_porta || 9100;

        atualizarCamposImpressora();
    } catch (error) {
        console.error('Erro ao carregar config da impressora:', error);
    }
}

async function salvarConfigImpressora() {
    try {
        const tipo = document.getElementById('impressora-tipo').value;
        let vendorId = document.getElementById('impressora-vendor-id').value.trim();
        let productId = document.getElementById('impressora-product-id').value.trim();

        const config = {
            ativada: document.getElementById('impressora-ativada').checked,
            tipo,
            ip: document.getElementById('impressora-ip').value.trim(),
            porta: parseInt(document.getElementById('impressora-porta').value) || 9100,
            usb_vendor_id: vendorId ? parseInt(vendorId, 16) : null,
            usb_product_id: productId ? parseInt(productId, 16) : null,
            largura: parseInt(document.getElementById('impressora-largura').value),
            esp32_impressora_ip: document.getElementById('impressora-esp32-ip').value.trim() || '192.168.88.29',
            esp32_impressora_porta: parseInt(document.getElementById('impressora-esp32-porta').value) || 9100
        };

        const response = await fetch('/api/impressora/config', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(config)
        });

        if (response.ok) {
            alert('Configuracao salva com sucesso!');
        } else {
            alert('Erro ao salvar configuracao!');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao salvar configuracao!');
    }
}

async function loadConfigs() {
    try {
        const response = await fetch('/api/configs');
        if (response.ok) {
            const configs = await response.json();
            if (configs.hora_inicio) document.getElementById('turno-inicio').value = configs.hora_inicio;
            if (configs.hora_fim) document.getElementById('turno-fim').value = configs.hora_fim;
            
            // Dados do estabelecimento
            if (configs.nome_estabelecimento) {
                const inputNome = document.getElementById('config-nome-estabelecimento');
                if (inputNome) inputNome.value = configs.nome_estabelecimento;
                
                // Atualizar cabeçalho e títulos se existirem
                const headerNome = document.getElementById('header-nome-estabelecimento');
                if (headerNome) headerNome.textContent = configs.nome_estabelecimento;
            }
            if (configs.endereco_estabelecimento) {
                const inputEnd = document.getElementById('config-endereco-estabelecimento');
                if (inputEnd) inputEnd.value = configs.endereco_estabelecimento;
            }
            if (configs.telefone_estabelecimento) {
                const inputTel = document.getElementById('config-telefone-estabelecimento');
                if (inputTel) inputTel.value = configs.telefone_estabelecimento;
            }
        }
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
    }
}

async function salvarDadosEstabelecimento() {
    const nome = document.getElementById('config-nome-estabelecimento').value.trim();
    const endereco = document.getElementById('config-endereco-estabelecimento').value.trim();
    const telefone = document.getElementById('config-telefone-estabelecimento').value.trim();

    if (!nome) {
        alert('O nome do estabelecimento e obrigatorio!');
        return;
    }

    try {
        const response = await fetch('/api/configs', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                nome_estabelecimento: nome,
                endereco_estabelecimento: endereco,
                telefone_estabelecimento: telefone
            })
        });
        
        if (response.ok) {
            alert('Dados do estabelecimento salvos com sucesso!');
            loadConfigs();
        } else {
            alert('Erro ao salvar dados!');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao conectar com o servidor.');
    }
}

async function salvarPeriodo() {
    const hora_inicio = document.getElementById('turno-inicio').value;
    const hora_fim = document.getElementById('turno-fim').value;
    
    if (!hora_inicio || !hora_fim) {
        alert('Selecione os horários de início e fim!');
        return;
    }

    try {
        const response = await fetch('/api/configs', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ hora_inicio, hora_fim })
        });
        
        if (response.ok) {
            alert('Período operacional salvo com sucesso!');
        } else {
            alert('Erro ao salvar período operacional!');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao salvar período operacional!');
    }
}

// =============================================
// XML ESTOQUE
// =============================================

let dadosXMLAtual = null;

async function lerXML() {
    alert("Arquivo selecionado! Iniciando leitura...");
    console.log("Iniciando leitura de XML...");
    const input = document.getElementById('xml-input');
    if (!input.files || input.files.length === 0) {
        console.log("Nenhum arquivo selecionado.");
        return;
    }

    const file = input.files[0];
    console.log("Arquivo selecionado:", file.name);
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/estoque/xml/ler', {
            method: 'POST',
            headers: {
                'X-User': sessionStorage.getItem('sys_username') || 'Sistema'
            },
            body: formData
        });

        if (response.ok) {
            dadosXMLAtual = await response.json();
            console.log("XML lido com sucesso:", dadosXMLAtual);
            renderItensXML();
            const modal = document.getElementById('modal-xml');
            if (modal) {
                modal.classList.remove('hidden');
                console.log("Modal exibido.");
            } else {
                console.error("Modal 'modal-xml' não encontrado!");
                alert("Erro: Interface do modal não encontrada.");
            }
        } else {
            const err = await response.json();
            console.error("Erro do servidor:", err);
            alert(err.detail || 'Erro ao ler XML');
        }
    } catch (error) {
        console.error('Erro na requisição:', error);
        alert('Erro ao processar arquivo XML. Verifique o console para mais detalhes.');
    } finally {
        input.value = ''; 
    }
}

function extrairFatorDeDescricao(descricao) {
    // Busca padrões como CX C/ 12, CX 12, C/ 12, X 12, etc.
    const regexes = [
        /CX\s*C\/\s*(\d+)/i,
        /C\/\s*(\d+)/i,
        /CX\s*(\d+)/i,
        /X\s*(\d+)/i,
        /PACK\s*(\d+)/i
    ];

    for (const regex of regexes) {
        const match = descricao.match(regex);
        if (match && match[1]) {
            return parseFloat(match[1]);
        }
    }
    return 1.0;
}

function renderItensXML() {
    const tbody = document.getElementById('tabela-itens-xml');
    const info = document.getElementById('xml-info');
    const total = document.getElementById('xml-total-nota');
    
    if (!tbody || !info || !total) {
        console.error("Elementos da tabela XML não encontrados!");
        return;
    }

    tbody.innerHTML = '';
    if (!dadosXMLAtual || !dadosXMLAtual.itens) return;
    
    info.textContent = `Chave: ${dadosXMLAtual.chave_acesso}`;
    total.textContent = `R$ ${dadosXMLAtual.total_nota.toFixed(2).replace('.', ',')}`;

    const listaProdutos = Array.isArray(produtos) ? produtos : [];
    const listaCategorias = Array.isArray(categorias) ? categorias : [];

    dadosXMLAtual.itens.forEach((item, index) => {
        // Tentar extrair fator da descrição e guardar como o "fator original da nota"
        if (!item.fator_xml) {
            item.fator_xml = extrairFatorDeDescricao(item.xProd);
        }

        // Se o fator atual ainda for o padrão 1.0, usamos o extraído do XML
        if (item.fator_conversao === 1.0 && item.fator_xml !== 1.0) {
            item.fator_conversao = item.fator_xml;
        }

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition-colors";
        
        // Select para mapear produto
        let options = '<option value="">-- Selecione para Mapear --</option>';
        options += `<option value="novo" style="font-weight: bold; color: #b45309;" ${item.criar_novo ? 'selected' : ''}>+ CADASTRAR: ${item.xProd}</option>`;
        
        listaProdutos.forEach(p => {
            const selected = item.produto_id === p.id ? 'selected' : '';
            options += `<option value="${p.id}" ${selected}>${p.nome}</option>`;
        });

        // Select para categorias (visível apenas se for criar novo)
        let catOptions = '<option value="">-- Selecione Categoria --</option>';
        listaCategorias.forEach(c => {
            const selected = item.categoria_id === c.id ? 'selected' : '';
            catOptions += `<option value="${c.id}" ${selected}>${c.nome}</option>`;
        });

        const showCategory = item.criar_novo ? '' : 'display: none;';

        tr.innerHTML = `
            <td class="px-4 py-4">
                <div class="font-medium text-slate-900">${item.xProd}</div>
                <div class="text-xs text-slate-400">Ref: ${item.cProd}</div>
            </td>
            <td class="px-4 py-4 text-slate-500 font-mono text-xs">${item.cEAN || 'N/A'}</td>
            <td class="px-4 py-4 text-center font-bold text-slate-700">${Math.round(item.qCom)}</td>
            <td class="px-4 py-4 text-center text-slate-500">${item.uCom}</td>
            <td class="px-4 py-4">
                <select onchange="atualizarMapeamentoXML(${index}, this.value)" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none mb-2">
                    ${options}
                </select>
                <select id="cat-xml-${index}" onchange="atualizarCategoriaXML(${index}, this.value)" class="w-full px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 outline-none" style="${showCategory}">
                    ${catOptions}
                </select>
            </td>
            <td class="px-4 py-4 text-center">
                <div class="flex flex-col items-center gap-1">
                    <input type="number" id="fator-xml-${index}" step="0.01" value="${item.fator_conversao}" oninput="atualizarFatorXML(${index}, this.value)" class="w-16 px-2 py-1 bg-white border border-slate-200 rounded text-center text-xs font-bold text-blue-600">
                    <span class="text-[10px] text-slate-400 uppercase">Fator</span>
                </div>
            </td>
            <td class="px-4 py-4 text-center">
                <div class="flex flex-col items-center">
                    <span class="font-bold text-emerald-600 text-lg" id="qtd-final-xml-${index}">
                        ${Math.round(item.qCom * item.fator_conversao)}
                    </span>
                    <span class="text-[10px] text-slate-400 uppercase">Unidades</span>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function atualizarMapeamentoXML(index, valor) {
    const item = dadosXMLAtual.itens[index];
    const catSelect = document.getElementById(`cat-xml-${index}`);
    
    if (valor === 'novo') {
        item.criar_novo = true;
        item.produto_id = null;
        if (catSelect) catSelect.style.display = 'block';
    } else {
        item.criar_novo = false;
        item.produto_id = valor ? parseInt(valor) : null;
        if (catSelect) catSelect.style.display = 'none';
    }
    // NÃO alteramos mais o item.fator_conversao aqui. 
    // O fator extraído inicialmente do XML permanece até que o usuário mude manualmente no input.
    atualizarFatorXML(index, item.fator_conversao);
}

function atualizarCategoriaXML(index, categoriaId) {
    dadosXMLAtual.itens[index].categoria_id = categoriaId ? parseInt(categoriaId) : null;
}

function atualizarFatorXML(index, fator) {
    const f = parseFloat(fator) || 0;
    dadosXMLAtual.itens[index].fator_conversao = f;
    const qtdFinal = Math.round(dadosXMLAtual.itens[index].qCom * f);
    document.getElementById(`qtd-final-xml-${index}`).textContent = qtdFinal;
}

function fecharModalXML() {
    document.getElementById('modal-xml').classList.add('hidden');
    dadosXMLAtual = null;
}

async function confirmarProcessamentoXML() {
    // Validar se pelo menos um item foi mapeado ou marcado para criar novo
    const itensParaProcessar = dadosXMLAtual.itens.filter(i => i.produto_id !== null || (i.criar_novo && i.categoria_id !== null));
    
    if (itensParaProcessar.length === 0) {
        alert('Mapeie os produtos ou selecione uma categoria para os novos produtos antes de confirmar!');
        return;
    }

    // Verificar se todos os marcados como "novo" têm categoria
    const novosSemCategoria = dadosXMLAtual.itens.filter(i => i.criar_novo && i.categoria_id === null);
    if (novosSemCategoria.length > 0) {
        alert('Selecione uma categoria para todos os novos produtos que deseja cadastrar!');
        return;
    }

    if (!confirm(`Deseja confirmar o processamento de ${itensParaProcessar.length} itens?`)) return;

    try {
        const response = await fetch('/api/estoque/xml/processar', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(dadosXMLAtual)
        });

        if (response.ok) {
            alert('Estoque atualizado e novos produtos cadastrados com sucesso!');
            fecharModalXML();
            loadEstoque();
            loadProdutos(); 
        } else {
            const err = await response.json();
            alert(err.detail || 'Erro ao processar XML');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro de conexão ao processar XML.');
    }
}

async function confirmarLimparCategoria() {
    const select = document.getElementById('select-categoria-limpar');
    const categoriaId = select.value;
    
    if (!categoriaId) {
        alert('Selecione uma categoria para limpar!');
        return;
    }

    const catNome = select.options[select.selectedIndex].text;
    
    const confirmacao = prompt(`ATENÇÃO: Isso irá APAGAR DEFINITIVAMENTE todos os produtos da categoria "${catNome}" e zerar seus estoques. \n\nPara confirmar, digite o nome da categoria exatamente como aparece: "${catNome}"`);
    
    if (confirmacao !== catNome) {
        if (confirmacao !== null) alert('Confirmação inválida! Operação cancelada.');
        return;
    }

    try {
        const response = await fetch(`/api/categorias/${categoriaId}/limpar`, {
            method: 'DELETE',
            headers: getHeaders()
        });

        if (response.ok) {
            const data = await response.json();
            alert(data.message);
            loadProdutos();
            loadEstoque();
            select.value = '';
        } else {
            const err = await response.json();
            alert(err.detail || 'Erro ao limpar categoria!');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro de conexão ao tentar limpar categoria.');
    }
}
