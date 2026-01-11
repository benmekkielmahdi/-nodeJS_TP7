// Importation des modules nécessaires
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Initialisation de l'application Express
const app = express();
const PORT = process.env.PORT || 3001;

// Assurez-vous que le dossier uploads existe
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configuration du stockage sur disque avec Multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        cb(null, uniqueSuffix + extension);
    }
});

// Configuration du filtrage des fichiers
const fileFilter = (req, file, cb) => {
    // Liste des types MIME autorisés
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    // Vérification du type MIME
    if (allowedMimeTypes.includes(file.mimetype)) {
        // Vérification de l'extension
        const extension = path.extname(file.originalname).toLowerCase();
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

        if (allowedExtensions.includes(extension)) {
            // Tout est OK
            cb(null, true);
        } else {
            // Extension non autorisée
            cb(new Error(`L'extension ${extension} n'est pas autorisée. Utilisez jpg, jpeg, png, gif ou webp.`), false);
        }
    } else {
        // Type MIME non autorisé
        cb(new Error(`Le type de fichier ${file.mimetype} n'est pas autorisé. Utilisez uniquement des images.`), false);
    }
};

// Fonction pour nettoyer les fichiers en cas d'erreur
function cleanupFiles(files) {
    // Si files est un objet (upload.fields)
    if (files && typeof files === 'object' && !Array.isArray(files)) {
        // Pour chaque type de champ
        Object.keys(files).forEach(key => {
            // Pour chaque fichier de ce champ
            files[key].forEach(file => {
                fs.unlink(file.path, (err) => {
                    if (err) console.error(`Erreur lors de la suppression du fichier ${file.path}:`, err);
                });
            });
        });
    }
    // Si files est un tableau (upload.array)
    else if (Array.isArray(files)) {
        files.forEach(file => {
            fs.unlink(file.path, (err) => {
                if (err) console.error(`Erreur lors de la suppression du fichier ${file.path}:`, err);
            });
        });
    }
    // Si files est un fichier unique (upload.single)
    else if (files && files.path) {
        fs.unlink(files.path, (err) => {
            if (err) console.error(`Erreur lors de la suppression du fichier ${files.path}:`, err);
        });
    }
}

// Initialisation de Multer avec stockage, filtrage et limites
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5 Mo en octets
        files: 1 // Nombre maximum de fichiers
    }
});

// Configuration pour les champs mixtes
const uploadMixed = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
}).fields([
    { name: 'image', maxCount: 1 },
    { name: 'galerie', maxCount: 2 }
]);

// Configuration des middlewares
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(express.urlencoded({ extended: true })); // Important pour récupérer req.body (titre, description)

// Route pour la page d'accueil
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'views', 'index.html');

    fs.readFile(indexPath, 'utf8', (err, data) => {
        if (err) {
            console.error('Erreur lecture fichier:', err);
            return res.status(500).send('Erreur serveur lors du chargement de la page.');
        }
        res.send(data);
    });
});

// Route pour gérer le téléversement d'un fichier unique
app.post('/upload', upload.single('fichier'), (req, res) => {
    // Le fichier est disponible dans req.file
    if (!req.file) {
        return res.status(400).send('Aucun fichier n\'a été téléversé.');
    }

    // Réponse au client avec le lien vers le fichier téléversé
    res.send(`
    <h1>Fichier téléversé avec succès!</h1>
    <p>Nom original: ${req.file.originalname}</p>
    <p>Taille: ${req.file.size} octets</p>
    <p>Type: ${req.file.mimetype}</p>
    <p><img src="/uploads/${req.file.filename}" style="max-width: 500px;"></p>
    <p><a href="/">Retour à l'accueil</a></p>
  `);
}, (err, req, res, next) => {
    // Nettoyage du fichier en cas d'erreur
    if (req.file) {
        cleanupFiles(req.file);
    }

    // Middleware de gestion d'erreurs spécifique à cette route
    let message = err.message;

    // Messages d'erreur plus explicites pour les erreurs courantes
    if (err.code === 'LIMIT_FILE_SIZE') {
        message = `Le fichier est trop volumineux. La taille maximale autorisée est de 5 Mo.`;
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        message = `Trop de fichiers téléversés ou nom de champ incorrect.`;
    }

    res.status(400).send(`
    <h1>Erreur lors du téléversement</h1>
    <p>${message}</p>
    <p><a href="/">Retour à l'accueil</a></p>
  `);
});

// Route pour gérer le téléversement de plusieurs fichiers
app.post('/upload-multiple', upload.array('fichiers', 3), (req, res) => {
    // Les fichiers sont disponibles dans req.files (tableau)
    if (!req.files || req.files.length === 0) {
        return res.status(400).send('Aucun fichier n\'a été téléversé.');
    }

    // Génération de la liste des fichiers téléversés
    const fileList = req.files.map(file => {
        return `
      <li>
        ${file.originalname} (${file.size} octets)
        <br>
        <img src="/uploads/${file.filename}" style="max-width: 200px; margin: 10px 0;">
      </li>
    `;
    }).join('');

    // Réponse au client
    res.send(`
    <h1>Fichiers téléversés avec succès!</h1>
    <p>Nombre de fichiers: ${req.files.length}</p>
    <ul style="list-style-type: none; padding: 0;">${fileList}</ul>
    <p><a href="/">Retour à l'accueil</a></p>
  `);
}, (err, req, res, next) => {
    // Nettoyage des fichiers en cas d'erreur
    if (req.files) {
        cleanupFiles(req.files);
    }

    // Middleware de gestion d'erreurs
    let message = err.message;

    if (err.code === 'LIMIT_FILE_SIZE') {
        message = `Un des fichiers est trop volumineux. La taille maximale autorisée est de 5 Mo.`;
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        message = `Trop de fichiers téléversés. Maximum 3 fichiers autorisés.`;
    }

    res.status(400).send(`
    <h1>Erreur lors du téléversement multiple</h1>
    <p>${message}</p>
    <p><a href="/">Retour à l'accueil</a></p>
  `);
});

// Route pour gérer le téléversement avec champs mixtes
app.post('/upload-with-data', uploadMixed, (req, res) => {
    // Vérification des fichiers
    if (!req.files || !req.files.image) {
        return res.status(400).send('L\'image principale est requise.');
    }

    // Récupération des données du formulaire
    const titre = req.body.titre || 'Sans titre';
    const description = req.body.description || 'Aucune description';

    // Image principale
    const mainImage = req.files.image[0];

    // Images de galerie (si présentes)
    const galerieImages = req.files.galerie || [];

    // Génération de la galerie HTML
    let galerieHtml = '';
    if (galerieImages.length > 0) {
        const imagesList = galerieImages.map(img => {
            return `
        <div class="gallery-item">
          <img src="/uploads/${img.filename}" alt="${img.originalname}">
          <p>${img.originalname} (${img.size} octets)</p>
        </div>
      `;
        }).join('');
        galerieHtml = `
      <h3>Images supplémentaires:</h3>
      <div style="display: flex; flex-wrap: wrap; gap: 20px;">${imagesList}</div>
    `;
    }

    // Réponse au client
    res.send(`
    <h1>${titre}</h1>
    <p>${description}</p>
    <h3>Image principale:</h3>
    <p><img src="/uploads/${mainImage.filename}" style="max-width: 500px;"></p>
    ${galerieHtml}
    <p><a href="/">Retour à l'accueil</a></p>
  `);
}, (err, req, res, next) => {
    // Nettoyage des fichiers en cas d'erreur
    if (req.files) {
        cleanupFiles(req.files);
    }

    // Middleware de gestion d'erreurs
    let message = err.message;

    if (err.code === 'LIMIT_FILE_SIZE') {
        message = `Un des fichiers est trop volumineux. La taille maximale autorisée est de 5 Mo.`;
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        message = `Trop de fichiers téléversés pour un des champs.`;
    }

    res.status(400).send(`
    <h1>Erreur lors du téléversement</h1>
    <p>${message}</p>
    <p><a href="/">Retour à l'accueil</a></p>
  `);
});

// Démarrage du serveur
app.listen(PORT, () => {
    console.log(`Serveur en cours d'exécution sur http://localhost:${PORT}`);
});
