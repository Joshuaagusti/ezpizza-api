const express = require("express");
const app = express();
const bcrypt = require("bcryptjs");

const dotenv = require("dotenv");
dotenv.config();

//archivos pa los token xd
const {generateToken, verifyToken}=require("../middleware/auth");


// conexión con la base de datos
const { connection } = require("../config/config.db");

//ruta LOGIN
const login = (request, response) => {
    const { username, password } = request.body;
  
    connection.query("SELECT * FROM clientes WHERE usuario=?", [username], (error, results) => {
        if (error) {
          return response.status(500).json({ error: "Error en el servidor" });
        }
        if (results.length === 0) {
          return response.status(404).json({ message: "Usuario no encontrado" });
        }
  
        const user = results[0];

        bcrypt.compare(password, user.Contraseña, (error, isMatch)=>{
            if(error){
                return response.status(500).json({message:"error al comparar contraseñas"});
            }
            if(isMatch){
                const token=generateToken(user);
                return response.status(200).json({token});
            }else{
                return response.status(401).json({message:"contraseña incorrecta"});
            }
        });
    });
};


//GET XD

const getProducts= (request, response)=>{
    const query="SELECT * FROM productos ORDER BY id_producto;";

    connection.query(query, (error, results)=>{
        if(error){
            console.error(error);
            return response.status(500).json({error: "error en el servidor"});
        }
        if(results.length==0){
            return response.status(404).json({message: "no hay nada vv"});
        }
        response.status(200).json(results);
    });
};

const getProductsbyID = (request, response) => {
    const{id}= request.params;
    const query= "SELECT * FROM productos WHERE id_producto=?;";
    
    connection.query(query, [id], (error, results)=>{
        if(error){
            console.error("error vv en:", error);
            return response.status(500).json({error: "error en el server vv"});
        }
        if(results.length==0){
            return response.status(404).json({message: "no hay nada vv"});
        }
        response.status(200).json(results);
    });
};



const getImages = (request, response) => {
    const{id}= request.params;

    const query= `
        SELECT url_imagen, is_cover FROM imagenes WHERE id_producto= ?;
    `;
    
    connection.query(query, [id], (error, results)=>{
        if(error){
            console.error("error vv en:", error);
            return response.status(500).json({error: "error en el server vv"});
        }
        if(results.length==0){
            return response.status(404).json({message: "no hay nada vv"});
        }
        response.status(200).json(results);
    });
};

const getReviewsbyID = (request, response) => {
    const{id}= request.params; //id_producto

    const query= `
        SELECT t.id_testimonio, c.usuario, t.comentario, t.calificacion,
        t.fecha_testimonio, t.id_producto, c.foto_perfil
        FROM testimonios t
        JOIN 
        clientes c ON t.id_cliente= c.id_cliente
        WHERE
        t.id_producto=?
        ORDER BY
        t.fecha_testimonio DESC;
    `;
    
    connection.query(query, [id], (error, results)=>{
        if(error){
            console.error("error vv en:", error);
            return response.status(500).json({error: "error en el server vv"});
        }
        if(results.length==0){
            return response.status(404).json({message: "no hay nada vv"});
        }
        response.status(200).json(results);
    });
};

const reviewPercentages=(request, response)=>{
    const{id}=request.params;

    const query=`
        WITH star_ratings AS (
        SELECT 1 AS rating
        UNION SELECT 2
        UNION SELECT 3
        UNION SELECT 4
        UNION SELECT 5
        )
        SELECT 
        star_ratings.rating,
        COALESCE(review_counts.review_count, 0) AS review_count,
        COALESCE(review_counts.percentage, 0) AS percentage
        FROM star_ratings
        LEFT JOIN (
            SELECT 
            calificacion AS rating,
            COUNT(*) AS review_count,
            ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM testimonios WHERE id_producto = ?), 0) AS percentage
            FROM testimonios
            WHERE id_producto = ?
            GROUP BY calificacion
        ) AS review_counts ON star_ratings.rating = review_counts.rating
        ORDER BY star_ratings.rating DESC;
    `;

    connection.query(query, [id, id], (error, results)=>{
        if(error){
            return response.status(500).json({message: "error en el server vv", error});
        }
        if(results.length==0){
            return response.status(404).json({message: "no hay nada vv"});
        }
        response.status(200).json(results);
    });
};

const categoryTree = (request, response) => {
    const query = `
        SELECT id_categoria, nombre_categoria, id_categoria_padre 
        FROM categorias
        ORDER BY id_categoria_padre, id_categoria;
    `;

    // Ejecutar la consulta
    connection.query(query, (error, results) => {
        if (error) {
            // Enviar respuesta en caso de error
            return response.status(500).json({ error: 'Error en la consulta a la base de datos' });
        }

        // Inicializar el objeto tree
        let tree = {};

        // Recorrer los resultados y construir la jerarquía
        results.forEach(category => {
            if (!category.id_categoria_padre) {
                // Si no tiene un padre, es una categoría principal
                tree[category.id_categoria] = {
                    name: category.nombre_categoria,
                    children: []
                };
            } else {
                // Si tiene un padre, agregarlo como hijo del padre correspondiente
                if (!tree[category.id_categoria_padre]) {
                    tree[category.id_categoria_padre] = { children: [] };
                }
                tree[category.id_categoria_padre].children.push({
                    id: category.id_categoria,
                    name: category.nombre_categoria
                });
            }
        });

        // Enviar la respuesta con el árbol de categorías
        response.json(tree);
    });
};

const isAdmin=(request, response)=>{
    const {id}=request.params;
    const query=`
        SELECT is_admin FROM clientes
        WHERE id_cliente=?;
    `;

    connection.query(query, [id], (error, results)=>{
        if(error){
            console.error("error vv en:", error);
            return response.status(500).json({error: "error en el server vv"});
        }
        if(results.length===0){
            return response.status(404).json({message: "cliente no encontrado"});
        }
        const isAdmin=results[0].is_admin===1;
        response.status(200).json({is_admin:isAdmin});
    });

};

//POST 
const insertProduct=(request, response)=>{
    const{nombre, descripcion, precio, stock, estado, id_categoria}=request.body;

    connection.query("INSERT INTO productos(nombre, descripcion, precio, stock, estado, id_categoria) VALUES(?,?,?,?,?,?)",
    [nombre, descripcion, precio, stock, estado, id_categoria],
    (error, results)=>{
        if(error)
            throw error;
        response.status(201).json({"item potaxie añadido, filas afectadas":
        results.affectedRows});
    });
};

const createClient=async(request, response)=>{
    try{
        const{nombre, Contraseña, email, direccion, telefono, estado, fecha_registro, usuario, is_admin}=request.body;
        
        const hashedPassword = await bcrypt.hash(Contraseña, 10);
        const query=`
            INSERT INTO clientes(nombre, Contraseña, email, direccion, telefono, estado, fecha_registro, usuario, is_admin)
            VALUES (?,?,?,?,?,?,?,?,?);
        `;

        connection.query(query, [nombre, hashedPassword, email, direccion, telefono, estado, fecha_registro, usuario, is_admin], (error, results)=>{
            if(error){
                console.error("error al registrar cliente:", error);
                return response.status(500).json({error: "error al registrar cliente"});
            }
            response.status(201).json({
                message:"cliente registrado con exito",
                clienteId: results.insertId
            });
        });
    } catch(error){
        console.error("error en el server", error);
        response.status(500).json({error:"error en el server", error});
    }
};


//DELETE :3
const deleteProduct=(request, response)=>{
    const { id } = request.params;

    const query = `
       UPDATE productos
        SET estado= 0
        WHERE id_producto= ?;
    `;

    connection.query(query, [id],(error, results) => {
        if (error) {
            console.error("Error en la consulta:", error);
            return response.status(500).json({ error: "Error en el servidor" });
        }
        if (results.length === 0) {
            return response.status(404).json({ message: "No se encontró el producto" });
        }
        response.status(200).json({message: "producto no disponible"});
    });
};


//ruta LOGIN
app.route("/login").post(login);

// rutas GET
app.route("/products").get(verifyToken, getProducts);
app.route("/products/:id").get(verifyToken, getProductsbyID);
app.route("/images/:id").get(verifyToken, getImages);
app.route("/reviews/:id").get(verifyToken, getReviewsbyID);
app.route("/reviews/:id/percentages").get(verifyToken, reviewPercentages);
app.route("/categories").get(verifyToken, categoryTree);
app.route("/isadmin/:id").get(verifyToken, isAdmin);

//rutas POST
app.route("/newproduct").post(verifyToken, insertProduct);
app.route("/signup").post(createClient);


//rutas DELETE
app.route("/deleteproduct/:id").delete(verifyToken, deleteProduct);

module.exports = app;


/*
-crear variables de entorno
-crear auth.js  con funcion generarToken 
-middleware con funcion verificarToken
-crear ruta login
-proteger las rutas con verificar token
*/