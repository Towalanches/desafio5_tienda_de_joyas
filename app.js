/* Dependencias */
const express = require('express')
const morgan = require('morgan')
const { Pool } = require('pg')
const format = require('pg-format')
require('dotenv').config()

/* Configuración del servidor */
const app = express()
const port = 3000

/* Configuración de la base de datos */
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
})

/* Middleware */
app.use(morgan('dev'))

/* Middleware para reportes */
app.use((req, res, next) => {
    console.log(`Rut consultada: ${req.method} ${req.url}`)
    next()
})

/* Ruta GET /joyas */
app.get('/joyas', async (req, res) => {
    try {
        const { limits, page = 1, order_by = 'id_ASC', precio_min, precio_max, categoria, metal } = req.query
        const [field, direction] = order_by.split('_')
        const limit = limits ? parseInt(limits) : null
        const offset = limit ? (page - 1) * limit : 0

        /* Filtros */
        const filters = []
        if (precio_min && isNaN(precio_min)) {
            throw new Error('El valor de precio_min debe ser un número válido')
        }
        if (precio_max && isNaN(precio_max)) {
            throw new Error('El valor de precio_max debe ser un número válido')
        }
        if (precio_min) {
            filters.push(format('precio >= %L', precio_min))
        }
        if (precio_max) {
            filters.push(format('precio <= %L', precio_max))
        }
        if (categoria) {
            filters.push(format('categoria = %L', categoria))
        }
        if (metal) {
            filters.push(format('metal = %L', metal))
        }

        const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : ''

        /* Consultar joyas con filtros y paginación */
        const query = format(
            `SELECT * FROM inventario ${whereClause} ORDER BY %I %s LIMIT %L OFFSET %L`,
            field, direction, limit, offset
        )
        const result = await pool.query(query)

        /* Consultar el total de joyas y stock de los resultados filtrados y limitados */
        const totalJoyas = result.rows.length
        const totalStock = result.rows.reduce((sum, joya) => sum + parseInt(joya.stock), 0)

        const hateoas = result.rows.map(joya => ({
            id: joya.id,
            nombre: joya.nombre,
            href: `/joyas/${joya.id}`
        }))

        /* Devolver resultados con el total de joyas y total de stock de los elementos consultados */
        res.json({
            total_joyas: totalJoyas,
            total_stock: totalStock,
            joyas: hateoas
        })

    } catch (error) {
        console.error(`Error en la ruta /joyas: ${error.message}`, error.stack)
        res.status(500).json({
            error: 'Hubo un problema al recuperar las joyas.',
            details: {
                message: error.message,
                stack: error.stack,
                route: '/joyas',
                timestamp: new Date().toISOString(),
                query_parameters: req.query
            }
        })
    }
})

/* Ruta GET /joyas/filtros */
app.get('/joyas/filtros', async (req, res) => {
    try {
        const { precio_min, precio_max, categoria, metal } = req.query
        const filters = []

        // Validación de parámetros
        if (precio_min && isNaN(precio_min)) {
            throw new Error('El valor de precio_min debe ser un número válido.')
        }
        if (precio_max && isNaN(precio_max)) {
            throw new Error('El valor de precio_max debe ser un número válido.')
        }

        if (precio_min) {
            filters.push(format('precio >= %L', precio_min))
        }
        if (precio_max) {
            filters.push(format('precio <= %L', precio_max))
        }
        if (categoria) {
            filters.push(format('categoria = %L', categoria))
        }
        if (metal) {
            filters.push(format('metal = %L', metal))
        }

        const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
        const query = `SELECT * FROM inventario ${whereClause}`

        const result = await pool.query(query)
        res.json(result.rows)

    } catch (error) {
        console.error(`Error en la ruta /joyas/filtros: ${error.message}`, error.stack)
        res.status(400).json({
            error: 'Parámetros incorrectos.',
            details: {
                message: error.message,
                stack: error.stack,
                route: '/joyas/filtros',
                timestamp: new Date().toISOString(),
                query_parameters: req.query
            }
        })
    }
})

/* Servidor escuchando */
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`)
})
