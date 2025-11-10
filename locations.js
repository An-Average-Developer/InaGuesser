// Games structure with zones and locations
const games = {
    "Inazuma Eleven 1": {
        generalMap: "images/locations/maps/Inazuma Eleven 1/General Map.jpg",
        zones: [
            {
                name: "Instituto Raimon",
                image: "images/locations/maps/Inazuma Eleven 1/Instituto Raimon.jpg",
                clickArea: { x: 35, y: 44, width: 23, height: 15 }
            },
            {
                name: "Zona Residencial",
                image: "images/locations/maps/Inazuma Eleven 1/Zona Residencial.jpg",
                clickArea: { x: 4, y: 45, width: 20, height: 15 }
            },
            {
                name: "Torre",
                image: "images/locations/maps/Inazuma Eleven 1/Torre.jpg",
                clickArea: { x: 79, y: 87, width: 15, height: 9 }
            },
            {
                name: "Ribera del Rio",
                image: "images/locations/maps/Inazuma Eleven 1/Ribera del Rio.jpg",
                clickArea: { x: 5, y: 79, width: 18, height: 15 }
            },
            {
                name: "Estacion",
                image: "images/locations/maps/Inazuma Eleven 1/Estacion.jpg",
                clickArea: { x: 30, y: 25, width: 20, height: 8 }
            }
        ],
        locationsByZone: {
            "Instituto Raimon": [
                {
                    name: "Campo del Raimon",
                    image: "images/locations/maps/Inazuma Eleven 1/Instituto Raimon/raimon-field.jpg"
                },
                {
                    name: "Entrada del Instituto Raimon",
                    image: "images/locations/maps/Inazuma Eleven 1/Instituto Raimon/raimon-entrance.jpg"
                },
                {
                    name: "Guarida del Gimnasio del Raimon",
                    image: "images/locations/maps/Inazuma Eleven 1/Instituto Raimon/guarida-raimon-gimnasio.jpg"
                },
                {
                    name: "Caseta del Club",
                    image: "images/locations/maps/Inazuma Eleven 1/Instituto Raimon/caseta-del-club.jpg"
                },
            ],
            "Zona Residencial": [
                {
                    name: "Casa de Mark",
                    image: "images/locations/maps/Inazuma Eleven 1/Zona Residencial/casa-de-mark.jpg"
                },
                {
                    name: "Salon de Mark",
                    image: "images/locations/maps/Inazuma Eleven 1/Zona Residencial/salon-de-mark.jpg"
                }
            ],
            "Torre": [
                {
                    name: "Torre Inazuma",
                    image: "images/locations/maps/Inazuma Eleven 1/Torre/inazuma-tower.jpg"
                }
            ],
            "Ribera del Rio": [
                {
                    name: "Ribera del Rio",
                    image: "images/locations/maps/Inazuma Eleven 1/Ribera del Rio/ribera-del-rio.jpg"
                }
            ],
            "Estacion": [
                {
                    name: "Estacion Inazuma",
                    image: "images/locations/maps/Inazuma Eleven 1/Estacion/estacion-inazuma.jpg"
                }
            ]
        }
    }
    // Add more games here:
    // "Inazuma Eleven 2": { ... },
    // "Inazuma Eleven 3": { ... }
};

// Legacy compatibility - use first game data
const firstGame = Object.keys(games)[0];
const zones = games[firstGame].zones;
const locationsByZone = games[firstGame].locationsByZone;
const locations = Object.values(locationsByZone).flat();
