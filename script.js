const API="http://localhost:5000";

function saveToken(token){
localStorage.setItem("token",token);
}

function getToken(){
return localStorage.getItem("token");
}

async function register(){

const data={
name:document.getElementById("name").value,
email:document.getElementById("email").value,
password:document.getElementById("password").value,
role:document.getElementById("role").value
};

const res=await fetch(API+"/register",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify(data)
});

const result=await res.json();
alert(result.message || result);

}

async function login(){

const data={
email:document.getElementById("email").value,
password:document.getElementById("password").value
};

const res=await fetch(API+"/login",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify(data)
});

const result=await res.json();
saveToken(result.token);
alert("Login successful");
}

async function loadProducts(){
const res=await fetch(API+"/products",{
headers:{
Authorization:"Bearer "+getToken()
}
});

const products=await res.json();
const container=document.getElementById("products");
container.innerHTML="";
products.forEach(p=>{
container.innerHTML+=`

<div class="product">
<img src="http://localhost:5000/uploads/${p.image}">
<h3>${p.name}</h3>
<p>₹${p.price}</p>
<button onclick="buyProduct('${p._id}')">
Buy
</button>
</div>
`;
});
}

async function buyProduct(id){
await fetch(API+"/buy-product/"+id,{
method:"POST",
headers:{
Authorization:"Bearer "+getToken()
}
});

alert("Order placed");
}
if(document.getElementById("products")){
loadProducts();
}