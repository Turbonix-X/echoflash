# ÉchoFlash

**A NOTER:** Ce site est fait à 100% par Intelligence Artifficielle (ou Super Intelligence pour les intimes).

Un jeu de mémoire en 2D ou en 3D : des orbes de couleur s'allument, il faut refaire la suite, et elle ne s'arrête jamais.

**Jouer en ligne : https://turbonix-x.github.io/echoflash/**

Ça marche sur ordi, tablette et téléphone, et il n'y a rien à installer.

## Ce qu'on peut faire

### Les couleurs

- Choisir de 2 à 20 couleurs.
- Changer chaque couleur : 7 couleurs prêtes, un nom (`orange`, `turquoise`…), un code (`#ff8800`), la palette du système, ou les couleurs récentes.
- Chaque couleur a sa propre note. Hors partie, on peut cliquer dessus pour s'entraîner.

### Les parties

- **Solo** : la suite s'allonge d'une couleur à chaque manche, sans limite. On a 3 vies.
- **Chacun son tour** : les deux joueurs refont la même suite, et le premier qui se trompe a perdu.
- **Piège** : chaque joueur refait la suite, puis ajoute sa propre couleur pour piéger l'autre.

### Les variantes, à combiner

- **Mélange** : la suite change entièrement à chaque manche, et on choisit sa longueur.
- **Une seule fois** : la suite de départ n'est montrée qu'une fois, ensuite seules les nouvelles couleurs le sont.
- **Éclipse** : pendant la démonstration, seule la couleur qui s'allume apparaît à l'écran.
- **Aveugle** : au début, chaque couleur joue son son une fois. Ensuite, on n'entend que le son.
- **Mort subite** : on meurt à la première faute.

Quelques variantes ne vont pas ensemble (Mélange et Une seule fois, Éclipse et Aveugle, Mélange et Piège). Le site le dit et coupe l'autre.

### Le reste

- La longueur de départ, de 1 à 100 000, et 4 vitesses.
- Le clavier : `1` à `0` puis `A` à `P` pour les couleurs, `Espace` pour lancer.
- Les statistiques : records, précision, les couleurs qui piègent le plus, les 10 dernières parties.
- Thème clair ou sombre, son et vibrations à couper, sauvegarde automatique, lien de partage et fichier de sauvegarde.

## Côté technique

C'est du HTML, du CSS et du JavaScript, sans outil de compilation. La 3D utilise Three.js, chargé seulement quand on la choisit.

La suite garde un seul octet par couleur et la page n'ajoute aucun élément quand elle s'allonge : le jeu reste aussi rapide à 1 000 couleurs qu'à 10.

Pour le lancer sur son PC :

```bash
python -m http.server 5530
```

Le style vient de [`STYLE-TURBONIX.md`](STYLE-TURBONIX.md).

---

Turbonix Entertainment
