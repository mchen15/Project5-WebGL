(function() {
    "use strict";
    /*global window,document,Float32Array,Uint16Array,mat4,vec3,snoise*/
    /*global getShaderSource,createWebGLContext,createProgram*/

    function sphericalToCartesian( r, a, e ) {
        var x = r * Math.cos(e) * Math.cos(a);
        var y = r * Math.sin(e);
        var z = r * Math.cos(e) * Math.sin(a);

        return [x,y,z];
    }

    var NUM_WIDTH_PTS = 64;
    var NUM_HEIGHT_PTS = 64;

    var message = document.getElementById("message");
    var canvas = document.getElementById("canvas");
    var gl = createWebGLContext(canvas, message);
    if (!gl) {
        return;
    }

    ///////////////////////////////////////////////////////////////////////////

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    var persp = mat4.create();
    mat4.perspective(45.0, canvas.width/canvas.height, 0.1, 100.0, persp);

    var radius = 5.0;
    var azimuth = Math.PI;
    var elevation = 0.0001;

    var eye = sphericalToCartesian(radius, azimuth, elevation);
    var center = [0.0, 0.0, 0.0];
    var up = [0.0, 1.0, 0.0];
    var view = mat4.create();
    mat4.lookAt(eye, center, up, view);

    // earth vertex and fragment shaders uniforms
    var u_DayDiffuseLocation;
    var u_NightLocation;
    var u_CloudLocation;
    var u_CloudTransLocation;
    var u_EarthSpecLocation;
    var u_BumpLocation;

    // moon vertex and fragment shaders uniforms
    var u_MoonDiffuseLocation;
    var u_MoonBumpLocation;

    // skybox
    var u_texSamplerLocation;

    // shared
    var positionLocation;
    var normalLocation;
    var texCoordLocation;
    var u_InvTransLocation;
    var u_ModelLocation;
    var u_ViewLocation;
    var u_PerspLocation;
    var u_CameraSpaceDirLightLocation;
    var u_timeLocation;
    
    function initializeEarthShader() {
        var vs = getShaderSource(document.getElementById("vs"));
        var fs = getShaderSource(document.getElementById("fs"));

        var program = createProgram(gl, vs, fs, message);
        positionLocation = gl.getAttribLocation(program, "Position");
        normalLocation = gl.getAttribLocation(program, "Normal");
        texCoordLocation = gl.getAttribLocation(program, "Texcoord");
        u_ModelLocation = gl.getUniformLocation(program,"u_Model");
        u_ViewLocation = gl.getUniformLocation(program,"u_View");
        u_PerspLocation = gl.getUniformLocation(program,"u_Persp");
        u_InvTransLocation = gl.getUniformLocation(program,"u_InvTrans");
        u_DayDiffuseLocation = gl.getUniformLocation(program,"u_DayDiffuse");
        u_NightLocation = gl.getUniformLocation(program,"u_Night");
        u_CloudLocation = gl.getUniformLocation(program,"u_Cloud");
        u_CloudTransLocation = gl.getUniformLocation(program,"u_CloudTrans");
        u_EarthSpecLocation = gl.getUniformLocation(program,"u_EarthSpec");
        u_BumpLocation = gl.getUniformLocation(program,"u_Bump");
        u_timeLocation = gl.getUniformLocation(program,"u_time");
        u_CameraSpaceDirLightLocation = gl.getUniformLocation(program,"u_CameraSpaceDirLight");

        gl.useProgram(program);
    }

    function initializeMoonShader() {
        var vs = getShaderSource(document.getElementById("moonVS"));
        var fs = getShaderSource(document.getElementById("moonFS"));

        var program = createProgram(gl, vs, fs, message);
        positionLocation = gl.getAttribLocation(program, "Position");
        normalLocation = gl.getAttribLocation(program, "Normal");
        texCoordLocation = gl.getAttribLocation(program, "Texcoord");
        u_ModelLocation = gl.getUniformLocation(program, "u_Model");
        u_ViewLocation = gl.getUniformLocation(program, "u_View");
        u_PerspLocation = gl.getUniformLocation(program, "u_Persp");
        u_InvTransLocation = gl.getUniformLocation(program, "u_InvTrans");
        u_MoonDiffuseLocation = gl.getUniformLocation(program, "u_Diffuse");
        u_MoonBumpLocation = gl.getUniformLocation(program, "u_Bump");
        u_timeLocation = gl.getUniformLocation(program, "u_time");
        u_CameraSpaceDirLightLocation = gl.getUniformLocation(program, "u_CameraSpaceDirLight");

        gl.useProgram(program);
    }

    function initializeSkyboxShader() {
        var vs = getShaderSource(document.getElementById("skyboxVS"));
        var fs = getShaderSource(document.getElementById("skyboxFS"));

        var program = createProgram(gl, vs, fs, message);
        positionLocation = gl.getAttribLocation(program, "Position");
        texCoordLocation = gl.getAttribLocation(program, "Texcoord");
        u_ModelLocation = gl.getUniformLocation(program, "u_Model");
        u_ViewLocation = gl.getUniformLocation(program, "u_View");
        u_PerspLocation = gl.getUniformLocation(program, "u_Persp");
        u_texSamplerLocation = gl.getUniformLocation(program, "u_textureSampler");
        
        gl.useProgram(program);
    }

    function initLoadedTexture(texture){
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    // initialize a non-power of 2 (NPOT) texture
    function initLoadedNPOTTexture(texture) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    function initSkyboxTexture(texture) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);

    }
    

    var numberOfIndices;

    function initializeSphere() {
        function uploadMesh(positions, texCoords, indices) {
            // Positions
            var positionsName = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, positionsName);
            gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
            gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(positionLocation);
            
            // Normals
            var normalsName = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, normalsName);
            gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
            gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(normalLocation);
            
            // TextureCoords
            var texCoordsName = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, texCoordsName);
            gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
            gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(texCoordLocation);

            // Indices
            var indicesName = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesName);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
        }

        var WIDTH_DIVISIONS = NUM_WIDTH_PTS - 1;
        var HEIGHT_DIVISIONS = NUM_HEIGHT_PTS - 1;

        var numberOfPositions = NUM_WIDTH_PTS * NUM_HEIGHT_PTS;

        var positions = new Float32Array(3 * numberOfPositions);
        var texCoords = new Float32Array(2 * numberOfPositions);
        var indices = new Uint16Array(6 * (WIDTH_DIVISIONS * HEIGHT_DIVISIONS));

        var positionsIndex = 0;
        var texCoordsIndex = 0;
        var indicesIndex = 0;
        var length;

        for( var j = 0; j < NUM_HEIGHT_PTS; ++j )
        {
            var inclination = Math.PI * (j / HEIGHT_DIVISIONS);
            for( var i = 0; i < NUM_WIDTH_PTS; ++i )
            {
                var azimuth = 2 * Math.PI * (i / WIDTH_DIVISIONS);
                positions[positionsIndex++] = Math.sin(inclination)*Math.cos(azimuth);
                positions[positionsIndex++] = Math.cos(inclination);
                positions[positionsIndex++] = Math.sin(inclination)*Math.sin(azimuth);
                texCoords[texCoordsIndex++] = i / WIDTH_DIVISIONS;
                texCoords[texCoordsIndex++] = j / HEIGHT_DIVISIONS;
            } 
        }

        for( var j = 0; j < HEIGHT_DIVISIONS; ++j )
        {
            var index = j*NUM_WIDTH_PTS;
            for( var i = 0; i < WIDTH_DIVISIONS; ++i )
            {
                    indices[indicesIndex++] = index + i;
                    indices[indicesIndex++] = index + i+1;
                    indices[indicesIndex++] = index + i+NUM_WIDTH_PTS;
                    indices[indicesIndex++] = index + i+NUM_WIDTH_PTS;
                    indices[indicesIndex++] = index + i+1;
                    indices[indicesIndex++] = index + i+NUM_WIDTH_PTS+1;
            }
        }

        uploadMesh(positions, texCoords, indices);
        numberOfIndices = indicesIndex;
    };

    var time = 0;
    var mouseLeftDown = false;
    var mouseRightDown = false;
    var lastMouseX = null;
    var lastMouseY = null;

    function handleMouseDown(event) {
        if( event.button == 2 ) {
            mouseLeftDown = false;
            mouseRightDown = true;
        }
        else {
            mouseLeftDown = true;
            mouseRightDown = false;
        }
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
    }

    function handleMouseUp(event) {
        mouseLeftDown = false;
        mouseRightDown = false;
    }

    function handleMouseMove(event) {
        if (!(mouseLeftDown || mouseRightDown)) {
            return;
        }
        var newX = event.clientX;
        var newY = event.clientY;

        var deltaX = newX - lastMouseX;
        var deltaY = newY - lastMouseY;
        
        if( mouseLeftDown )
        {
            azimuth += 0.01 * deltaX;
            elevation += 0.01 * deltaY;
            elevation = Math.min(Math.max(elevation, -Math.PI/2+0.001), Math.PI/2-0.001);
        }
        else
        {
            radius += 0.01 * deltaY;
            radius = Math.min(Math.max(radius, 2.0), 10.0);
        }
        eye = sphericalToCartesian(radius, azimuth, elevation);
        view = mat4.create();
        mat4.lookAt(eye, center, up, view);

        lastMouseX = newX;
        lastMouseY = newY;
    }

    canvas.onmousedown = handleMouseDown;
    canvas.oncontextmenu = function(ev) {return false;};
    document.onmouseup = handleMouseUp;
    document.onmousemove = handleMouseMove;


    function drawEarth() {
        ///////////////////////////////////////////////////////////////////////////
        // Update

        var model = mat4.create();
        mat4.identity(model);
        mat4.scale(model, [1.0, 1.0, 1.0]);
        mat4.rotate(model, 23.4 / 180 * Math.PI, [0.0, 0.0, 1.0]);
        mat4.rotate(model, Math.PI, [1.0, 0.0, 0.0]);
        mat4.rotate(model, -time, [0.0, 1.0, 0.0]);
        var mv = mat4.create();
        mat4.multiply(view, model, mv);

        var invTrans = mat4.create();
        mat4.inverse(mv, invTrans);
        mat4.transpose(invTrans);

        var lightdir = vec3.create([1.0, 0.0, 1.0]);
        var lightdest = vec4.create();
        vec3.normalize(lightdir);
        mat4.multiplyVec4(view, [lightdir[0], lightdir[1], lightdir[2], 0.0], lightdest);
        lightdir = vec3.createFrom(lightdest[0], lightdest[1], lightdest[2]);
        vec3.normalize(lightdir);

        ///////////////////////////////////////////////////////////////////////////
        // Render
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.uniformMatrix4fv(u_ModelLocation, false, model);
        gl.uniformMatrix4fv(u_ViewLocation, false, view);
        gl.uniformMatrix4fv(u_PerspLocation, false, persp);
        gl.uniformMatrix4fv(u_InvTransLocation, false, invTrans);

        gl.uniform3fv(u_CameraSpaceDirLightLocation, lightdir);

        // The value you set into the GLSL sampler uniform is index of texture unit 
        // to which you have to bind the desired texture.
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, dayTex);
        gl.uniform1i(u_DayDiffuseLocation, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, bumpTex);
        gl.uniform1i(u_BumpLocation, 1);

        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, cloudTex);
        gl.uniform1i(u_CloudLocation, 2);

        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, transTex);
        gl.uniform1i(u_CloudTransLocation, 3);

        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D, lightTex);
        gl.uniform1i(u_NightLocation, 4);

        gl.activeTexture(gl.TEXTURE5);
        gl.bindTexture(gl.TEXTURE_2D, specTex);
        gl.uniform1i(u_EarthSpecLocation, 5);

        gl.uniform1f(u_timeLocation, time);

        gl.drawElements(gl.TRIANGLES, numberOfIndices, gl.UNSIGNED_SHORT, 0);
        
    }

    function drawMoon()
    {
        ///////////////////////////////////////////////////////////////////////////
        // Update
        var model = mat4.create();
        mat4.identity(model);
        
        mat4.rotate(model, 5.14 / 180 * Math.PI, [0.0, 0.0, 1.0]);
        mat4.rotate(model, Math.PI, [1.0, 0.0, 0.0]);
        mat4.rotate(model, -0.5*time, [0.0, 1.0, 0.0]);
        mat4.translate(model, [5.0, 0.0, 0.0]);
        mat4.scale(model, [0.27, 0.27, 0.27]);
        mat4.rotate(model, 5.0*time, [0.0, 1.0, 0.0]); // rotation

        var mv = mat4.create();
        mat4.multiply(view, model, mv);

        var invTrans = mat4.create();
        mat4.inverse(mv, invTrans);
        mat4.transpose(invTrans);

        var lightdir = vec3.create([1.0, 0.0, 1.0]);
        var lightdest = vec4.create();
        vec3.normalize(lightdir);
        mat4.multiplyVec4(view, [lightdir[0], lightdir[1], lightdir[2], 0.0], lightdest);
        lightdir = vec3.createFrom(lightdest[0], lightdest[1], lightdest[2]);
        vec3.normalize(lightdir);

        ///////////////////////////////////////////////////////////////////////////
        // Render
        gl.uniformMatrix4fv(u_ModelLocation, false, model);
        gl.uniformMatrix4fv(u_ViewLocation, false, view);
        gl.uniformMatrix4fv(u_PerspLocation, false, persp);
        gl.uniformMatrix4fv(u_InvTransLocation, false, invTrans);
        gl.uniform3fv(u_CameraSpaceDirLightLocation, lightdir);

        gl.activeTexture(gl.TEXTURE6);
        gl.bindTexture(gl.TEXTURE_2D, moonDiffuseTex);
        gl.uniform1i(u_MoonDiffuseLocation, 6);

        gl.activeTexture(gl.TEXTURE7);
        gl.bindTexture(gl.TEXTURE_2D, moonBumpTex);
        gl.uniform1i(u_MoonBumpLocation, 7);

        gl.uniform1f(u_timeLocation, time);

        gl.drawElements(gl.TRIANGLES, numberOfIndices, gl.UNSIGNED_SHORT, 0);
 
    }

    function drawSkybox() {

        // set up vertices
        var vertBuffer = gl.createBuffer();
        var vertices = [
            // Front face
            -1.0, -1.0, 1.0,
            1.0, -1.0, 1.0,
            1.0, 1.0, 1.0,
            -1.0, 1.0, 1.0,

            // Back face
            -1.0, -1.0, -1.0,
            -1.0, 1.0, -1.0,
            1.0, 1.0, -1.0,
            1.0, -1.0, -1.0,

            // Top face
            -1.0, 1.0, -1.0,
            -1.0, 1.0, 1.0,
            1.0, 1.0, 1.0,
            1.0, 1.0, -1.0,

            // Bottom face
            -1.0, -1.0, -1.0,
            1.0, -1.0, -1.0,
            1.0, -1.0, 1.0,
            -1.0, -1.0, 1.0,

            // Right face
            1.0, -1.0, -1.0,
            1.0, 1.0, -1.0,
            1.0, 1.0, 1.0,
            1.0, -1.0, 1.0,

            // Left face
            -1.0, -1.0, -1.0,
            -1.0, -1.0, 1.0,
            -1.0, 1.0, 1.0,
            -1.0, 1.0, -1.0
        ];
        
        gl.bindBuffer(gl.ARRAY_BUFFER, vertBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(positionLocation);

        // set up indices
        var indexBuffer = gl.createBuffer();
        var indices = [
           0, 1, 2, 0, 2, 3,         // front
           4, 5, 6, 4, 6, 7,         // back
           8, 9, 10, 8, 10, 11,      // top
           12, 13, 14, 12, 14, 15,   // bottom
           16, 17, 18, 16, 18, 19,   // right
           20, 21, 22, 20, 22, 23    // left
        ];

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

        // set up texture coordinates
        var textureCoordsBuffer = gl.createBuffer();
        var textureCoordinates = [
            // Used debug skybox to figure out these texture coordinates!
            // Front
            0.0, 0.0,
            1.0, 0.0,
            1.0, 1.0,
            0.0, 1.0,
            // Back
            1.0, 0.0,
            1.0, 1.0,
            0.0, 1.0,
            0.0, 0.0,
            // Top
            0.0, 1.0,
            0.0, 0.0,
            1.0, 0.0,
            1.0, 1.0,
            // Bottom
            0.0, 0.0,
            1.0, 0.0,
            1.0, 1.0,
            0.0, 1.0,
            // Right
            1.0, 0.0,
            1.0, 1.0,
            0.0, 1.0,
            0.0, 0.0,
            // Left
            0.0, 0.0,
            1.0, 0.0,
            1.0, 1.0,
            0.0, 1.0
        ];

        gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordsBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);
        gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(texCoordLocation);

        ///////////////////////////////////////////////////////////////////////////
        // Render
        var model = mat4.create();
        mat4.identity(model);
        mat4.scale(model, [25.0, 25.0, 25.0]);
        gl.uniformMatrix4fv(u_ModelLocation, false, model);
        gl.uniformMatrix4fv(u_ViewLocation, false, view);
        gl.uniformMatrix4fv(u_PerspLocation, false, persp);

        // front
        gl.activeTexture(gl.TEXTURE8);
        gl.bindTexture(gl.TEXTURE_2D, skyFrontTex);
        gl.uniform1i(u_texSamplerLocation, 8);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0); // byte offset

        // back
        gl.activeTexture(gl.TEXTURE9);
        gl.bindTexture(gl.TEXTURE_2D, skyBackTex);
        gl.uniform1i(u_texSamplerLocation, 9);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 12); // 6 verts, 2 bytes per vert

        // top
        gl.activeTexture(gl.TEXTURE10);
        gl.bindTexture(gl.TEXTURE_2D, skyTopTex);
        gl.uniform1i(u_texSamplerLocation, 10);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 24);

        // bot
        gl.activeTexture(gl.TEXTURE11);
        gl.bindTexture(gl.TEXTURE_2D, skyBotTex);
        gl.uniform1i(u_texSamplerLocation, 11);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 36);

        // right
        gl.activeTexture(gl.TEXTURE12);
        gl.bindTexture(gl.TEXTURE_2D, skyRightTex);
        gl.uniform1i(u_texSamplerLocation, 12);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 48);

        // left
        gl.activeTexture(gl.TEXTURE13);
        gl.bindTexture(gl.TEXTURE_2D, skyLeftTex);
        gl.uniform1i(u_texSamplerLocation, 13);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 60);
    }

    // animate is responsible for drawing the earth and moon
    function animate() {

        // Earth
        var start = new Date().getMilliseconds();
        initializeEarthShader();
        initializeSphere();
        drawEarth();
        var end = new Date().getMilliseconds();
        var totaltime = end - start;
        console.log('Earth Rendering Execution time: ' + totaltime);

        // Moon
        var start = new Date().getMilliseconds();
        initializeMoonShader();
        initializeSphere();
        drawMoon();
        var end = new Date().getMilliseconds();
        var totaltime = end - start;
        console.log('Moon Rendering Execution time: ' + totaltime);

        // Skybox
        var start = new Date().getMilliseconds();
        initializeSkyboxShader();
        drawSkybox();
        var end = new Date().getMilliseconds();
        var totaltime = end - start;
        console.log('Skybox Rendering Execution time: ' + totaltime);

        time += 0.001;
        
        window.requestAnimFrame(animate);
    }

    var earthTextureCount = 0;
    var moonTextureCount = 0;
    var skyboxTextureCount = 0;

    // earth textures
    var dayTex;
    var bumpTex;
    var cloudTex;
    var transTex;
    var lightTex;
    var specTex;

    // moon textures
    var moonDiffuseTex;
    var moonBumpTex;

    // skybox textures
    var skyFrontTex;
    var skyBackTex;
    var skyTopTex;
    var skyBotTex;
    var skyRightTex;
    var skyLeftTex;

    (function createEarthTexture() {
        dayTex = gl.createTexture();
        bumpTex = gl.createTexture();
        cloudTex = gl.createTexture();
        transTex = gl.createTexture();
        lightTex = gl.createTexture();
        specTex = gl.createTexture();
    }());
    
    (function initializeEarthTextures() {
        initializeTexture(dayTex, "earthmap1024.png", "earth");
        initializeTexture(bumpTex, "earthbump1024.png", "earth");
        initializeTexture(cloudTex, "earthcloud1024.png", "earth");
        initializeTexture(transTex, "earthtrans1024.png", "earth");
        initializeTexture(lightTex, "earthlight1024.png", "earth");
        initializeTexture(specTex, "earthspec1024.png", "earth");
    }());

    (function createMoonTexture() {
        moonDiffuseTex = gl.createTexture();
        moonBumpTex = gl.createTexture();
    }());

    (function initializeMoonTextures() {
        initializeTexture(moonDiffuseTex, "moonmap.jpg", "moon");
        initializeTexture(moonBumpTex, "moonbumpmap.jpg", "moon");
    }());

    (function createSkyboxTexture() {
        skyFrontTex = gl.createTexture();
        skyBackTex = gl.createTexture();
        skyTopTex = gl.createTexture();
        skyBotTex = gl.createTexture();
        skyRightTex = gl.createTexture();
        skyLeftTex = gl.createTexture();
    }());

    (function initializeSkyboxTexture() {
        initializeTexture(skyFrontTex, "purpleNebula_front5.png", "skybox");
        initializeTexture(skyBackTex, "purpleNebula_back6.png", "skybox");
        initializeTexture(skyTopTex, "purpleNebula_top3.png", "skybox");
        initializeTexture(skyBotTex, "purpleNebula_bottom4.png", "skybox");
        initializeTexture(skyRightTex, "purpleNebula_right1.png", "skybox");
        initializeTexture(skyLeftTex, "purpleNebula_left2.png", "skybox");
    }());


    // type = 1 for earth texture, otherwise moon texture
    function initializeTexture(texture, src, type) {
        texture.image = new Image();
        texture.image.onload = function() {
            

            if (type == "earth") {
                earthTextureCount++;
                initLoadedTexture(texture);
            }
            else if (type == "moon") {
                moonTextureCount++;
                initLoadedNPOTTexture(texture);
            }
            else if (type == "skybox") {
                skyboxTextureCount++;
                initSkyboxTexture(texture);
            }
            
            // Animate once textures load.
            if (earthTextureCount === 6 && moonTextureCount == 2 && skyboxTextureCount == 6) {
                animate();
            }
        }
        texture.image.src = src;
    }
    
}());
