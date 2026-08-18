# Whapy: dual remote (repo personal + org)

Playbook reutilizable para subir un proyecto a los repos vacíos (o casi vacíos) de **Whapy-Dev** sin mudar deploys ni `.env`.

## Idea

- **Un solo working copy** local.
- **`origin`** = tu repo personal → deploys, EAS, Vercel, secrets que ya funcionan.
- **`whapy`** = repo de la empresa → entrega / espejo; no reconectar CI ahí salvo que lo pidan.
- Día a día: commit normal → push a ambos.

No clones el repo vacío de Whapy para “rellenarlo”. Pusheás el historial desde el repo que ya usás.

## Primera vez (por proyecto)

En la carpeta del proyecto (el clone que ya usás):

```bash
# 1) Ver remotos actuales
git remote -v
git branch --show-current
git status -sb

# 2) Agregar remoto de Whapy (NO reemplazar origin)
git remote add whapy https://github.com/Whapy-Dev/NOMBRE-DEL-REPO.git

# 3) Ver qué hay en el remoto de la empresa
git fetch whapy
git log --oneline whapy/main -3 2>/dev/null || git log --oneline whapy/master -3

# 4a) Si Whapy está vacío → push normal
git push -u whapy main

# 4b) Si solo tiene "Initial commit" + README (historial distinto)
#     Confirmá que el árbol remoto es solo README, luego:
git push --force-with-lease whapy main

# 5) Dejar el tracking diario en TU repo (importante)
git branch --set-upstream-to=origin/main main

# 6) Asegurar que origin también tiene lo último
git push origin main
```

Sustituí:

| Placeholder | Ejemplo T2T fase 1 |
|---|---|
| `NOMBRE-DEL-REPO` | `T2T-fase1` |
| rama | `main` (o `master` si allá usan otra) |

### Si la rama remota se llama distinto

```bash
# subir tu main como master en Whapy
git push whapy main:master
```

### Verificación

```bash
git rev-parse main
git ls-remote origin refs/heads/main
git ls-remote whapy refs/heads/main
# los tres SHA deben coincidir
```

## Día a día (después de cada commit)

```bash
git push origin main
git push whapy main
```

Atajo:

```bash
git push origin main && git push whapy main
```

`git push` / `git pull` sin args siguen yendo a **origin** (si dejaste el upstream como arriba).

## Varios proyectos Whapy

Repetí el mismo esquema en cada carpeta local:

```bash
git remote add whapy https://github.com/Whapy-Dev/OTRO-REPO.git
# … fetch / push / set-upstream-to=origin/…
```

Si un producto tiene **fase 2** en otro repo:

```bash
git remote add whapy-fase2 https://github.com/Whapy-Dev/T2T-fase2.git
# cuando toque entregar fase 2:
git push whapy-fase2 main
```

No mezcles fase 1 y fase 2 en el mismo remoto si ellos los tienen separados.

## Checklist antes del primer push a Whapy

- [ ] `origin` sigue siendo tu repo personal (deploys intactos).
- [ ] No vas a pushear `.env` reales; revisá `git status` y `.gitignore`.
- [ ] Si hay archivos grandes (>50 MB), GitHub puede avisar (ej. mock de video); el push puede pasar igual.
- [ ] Si Whapy no está vacío y tiene código ajeno (no solo README), **no** hagas force: hablá con el equipo.
- [ ] Tras `git push -u whapy …`, volvé el upstream a `origin` (`--set-upstream-to=origin/main`).

## Qué NO hacer

- Clonar el repo vacío de Whapy y copiar archivos a mano (perdés historial).
- Cambiar `origin` al de Whapy (rompe el hábito de deploy / URLs de CI).
- Reconectar Vercel/EAS al repo de Whapy “por las dudas” (salvo pedido explícito).
- Force push a Whapy si ya hay trabajo de otra persona.

## Remotos actuales de este repo (Legajo Técnico)

| Remote | URL | Rol |
|---|---|---|
| `origin` | `https://github.com/GabrieLZ19/Legajo-Tecnico.git` | Trabajo + deploys |
| `whapy` | `https://github.com/Whapy-Dev/legajo-t-cnico.git` | Entrega / espejo Whapy |

Primera carga a Whapy hecha: `main` = `1404207` (force-with-lease sobre Initial commit + README).

## Copiar este doc a otro proyecto

Podés copiar este archivo a `docs/WHAPY_DUAL_REMOTE.md` del otro repo y solo cambiar la tabla de remotos / URL de `whapy`.
