# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['run.py'],
    pathex=[],
    binaries=[],
    datas=[('C:\\Users\\Rodrigo Tanque\\Documents\\trae_projects\\glpi\\caixa-bar\\frontend', 'frontend'), ('C:\\Users\\Rodrigo Tanque\\Documents\\trae_projects\\glpi\\caixa-bar\\backend', 'backend')],
    hiddenimports=['uvicorn', 'fastapi', 'sqlalchemy', 'pydantic', 'jinja2'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='TocaDoLobo',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='NONE',
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='TocaDoLobo',
)
