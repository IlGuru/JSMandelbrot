"use strict";
var page = require('webpage').create();
page.onConsoleMessage = function(msg) {
  console.log(' ' + msg);
};
page.viewportSize = { width: 600, height : 600 };
page.content = '<html><body><canvas id="surface"></canvas></body></html>';
page.evaluate(function() {
    var el = document.getElementById('surface'),
        context = el.getContext('2d'),
        width = window.innerWidth,
        height = window.innerHeight,
        imageData,
        pixels,
        ton, sat, lum,
        i = 0, x, y;

	Complex = function( R, I ){
		this.r	= R,
		this.i	= I,
		this.mod= function(){
			return Math.sqrt( (this.r*this.r)+(this.i*this.i) );
		},
		this.sum= function( O ){
			this.r	+= O.r;
			this.i	+= O.i;
		},
		this.mol= function( O ){
			var A = new Complex( this.r, this.i );
			var B = new Complex( O.r, O.i );
			this.r	= (A.r*B.r)-(A.i*B.i);
			this.i	= (A.r*B.i)+(B.r*A.i);
		},
		this.pot= function(){
			this.mol( this );
		},
		this.show= function(){
			return ( this.r != 0.0 ? this.r : '' ) + ( this.r != 0.0 && this.i != 0.0 ? ', ' : '' ) + ( this.i != 0.0 ? ( this.i == 1.0 ? '' : ( this.i == -1.0 ? '-' : this.i ) ) + 'i' : '');
		};
	};
	
	MBSet = function( R, I, Rad, W, H ){
		this.RMin	= R - Rad, 				//	Valore reale min
		this.RMax	= R + Rad,				//	Valore reale max
		this.IMin	= I - Rad,				//	Valore imm min
		this.IMax	= I + Rad,				//	Valore imm max
		this.Width	= W,					//	Dimensioni grafico in punti x
		this.Height	= H,					//	Dimensioni grafico in punti y
		this.Px		= 0.0,					//	Punto x
		this.Py		= 0.0,					//	Punto y
		this.Z		= new Complex( 0, 0 ),	//	Z per la funzione
		this.C		= new Complex( 0, 0 ),	//	C per la funzione
		this.SetP	= function( pX, pY ){	//	Imposta il punto (x,y) nel grafico 0 > x > this.Width, 0 > y > this.Height
			this.Px	= pX;
			this.Py	= pY;
		},
		this.RAtt	= function(){			//	Parte reale del numero nel piano di Gauss corrispondente al punto x nel grafico
			var r = this.RMin + ( this.Px / this.Width ) * ( this.RMax - this.RMin );
			return r;
		},
		this.IAtt	= function(){			//	Parte immaginaria del numero nel piano di Gauss corrispondente al punto y nel grafico
			var i = this.IMin + ( this.Py / this.Height ) * ( this.IMax - this.IMin );
			return i;
		},
		this.Sx		= function( MaxSx ){	//	Indice per cui la serie diverge this.Z.mod() > 2.0
			var Sx 		= 0;				//	Indice della serie
			this.Z.r	= 0;				//	Inizializzo Z
			this.Z.i 	= 0;
			while( Sx < MaxSx && this.Z.mod() < 2.0 ) {
				//	Calcolo la serie Z( Sx+1 ) = Z( Sx )^2 + C
				this.Z.pot();
				this.Z.sum(this.C);
				Sx++;
			}
			return Sx--;
		};
	};
	
	/**
	 * Converts an HSL color value to RGB. Conversion formula
	 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
	 * Assumes h, s, and l are contained in the set [0, 1] and
	 * returns r, g, and b in the set [0, 255].
	 *
	 * @param   {number}  h       The hue
	 * @param   {number}  s       The saturation
	 * @param   {number}  l       The lightness
	 * @return  {Array}           The RGB representation
	 */
	function hslToRgb(h, s, l){
		var r, g, b;

		//console.log( '     H:' + h + ' S:' + s + ' L:' + l );

		if(s == 0){
			r = g = b = l; // achromatic
		} else {
			var hue2rgb = function hue2rgb(p, q, t){
				if(t < 0) t += 1;
				if(t > 1) t -= 1;
				if(t < 1/6) return p + (q - p) * 6 * t;
				if(t < 1/2) return q;
				if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
				return p;
			}

			var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
			var p = 2 * l - q;
			r = hue2rgb(p, q, h + 1/3);
			g = hue2rgb(p, q, h);
			b = hue2rgb(p, q, h - 1/3);
		}

		return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
	};

	function mapSx( MinSx, MaxSx, Sx ) {
		if ( Sx > MaxSx )
			return 255;
		if ( Sx < MinSx )
			return 0;
		
		return Math.floor( 255 * ( ( Sx - MinSx ) / ( MaxSx - MinSx ) ) );
	};
	
	var MB= new MBSet( 0.4, -0.21,  0.02, width, height );

	var Debug	= false;
	var Sx 		= 0;
	var SxMin	= 2;
	var SxMax	= 34;
	var rgb 	= [];
	var dist 	= [];
	
    el.width  = width;
    el.height = height;
    imageData = context.createImageData(width, height);
    pixels = imageData.data;

    for (y = 0; y < height; y++) {
		
		console.log( (y+1) + '/' + height );
        
		for (x = 0; x < width; x++, i = i + 4) {

			//	Imposto il punto (x,y) nel grafico
			MB.SetP( x, y );
			
			//	Calcolo il valore di C in funzione del punto (x,y)
			MB.C.r = MB.RAtt();
			MB.C.i = MB.IAtt();

			Sx = MB.Sx( SxMax );
			Sx = mapSx( SxMin, SxMax, Sx )

			if ( Debug ) {
				//	Aggiungo un hit a questo indice della serie
				if ( typeof( dist[ Sx ] ) === "undefined" ) {
					dist[ Sx ] = 1;
				} else {
					dist[ Sx ]++;
				}
			}
			
			if ( Sx > 255 - 128/(SxMax-SxMin) ) {
				rgb = [0,0,0]
			} else {
				if ( Sx < 0 + 128/(SxMax-SxMin) ) {
					rgb = [255,255,255]
				} else {
					rgb = hslToRgb( (Sx/255.0), 1.0, 0.5 ); 
				}
			}

			pixels[i]     = rgb[0];
			pixels[i + 1] = rgb[1];
			pixels[i + 2] = rgb[2];
			pixels[i + 3] = 255;

        }
    
	}

	if ( Debug ) {
		//	Visualizzazione array con il numero di hit per ogni indice della serie in cui il modulo ha superato il valore 2.0
		for (Sx = 0; Sx < 256; Sx++) {
			console.log( Sx + ';' + ( typeof( dist[ Sx ] ) !== "undefined" ? dist[ Sx ] + ';' + 100*dist[ Sx ]/(width*height) + '%' : '0;0%' ) );
		}
	}
	
    context.putImageData(imageData, 0, 0);
    document.body.style.backgroundColor = 'white';
    document.body.style.margin = '0px';
});

page.render('mandelbrot.png');

phantom.exit();
