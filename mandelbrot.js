"use strict";
var page = require('webpage').create();
var system = require('system');

if (system.args.length !== 7) {
    console.log('phantomjs mandelbrot.js width height Quality Cr Ci Rad FileName.png');
};

var pWidth 		= ( typeof(system.args[1])	=== 'undefined' ? 600 	: parseInt(  system.args[1]));
var pHeight		= ( typeof(system.args[2])	=== 'undefined' ? 600 	: parseInt(  system.args[2]));
var pDef 		= ( typeof(system.args[3])	=== 'undefined' ? 32 	: parseInt(  system.args[3]));
var pCr			= ( typeof(system.args[4])	=== 'undefined' ? -0.5 	: parseFloat(system.args[4]));
var pCi			= ( typeof(system.args[5])	=== 'undefined' ? 0.0 	: parseFloat(system.args[5]));
var pRad 		= ( typeof(system.args[6])	=== 'undefined' ? 1.5 	: parseFloat(system.args[6]));
var pFileName 	= ( typeof(system.args[7])	=== 'undefined' ? 'mandelbrot' + '_(' + pCr + '_' + pCi + '_' + pRad + ')_(' + pWidth + 'x' + pHeight + '@' + pDef + ').png' : system.args[7] );

/*
	pDef:
	Aumentare la pDef è utile quando si osservano zone molto ristrette, altrimenti si vedono meno livelli.
	pDef è il numero massimo di iterazioni x della funzione Z(x) = Z(x-1)^2 + C
	La distribuzione di x non è lineare ma concentrata nei valori più bassi: 
	nx
	^
	|  *                  '
	|  *                  '
	|  **                 '
	|  **                 '
	|  ***                '
	|  ****               '
	| ********            '
	|****************     '
	+-----------------------------------> x
	0                     pDef
	Quindi aumentare il numero pDef significa che poi rimappando le x nei livelli di colore L da 0 a 256 
		si raggruppano tutti i valori più bassi L in un valore solo.
	Poichè un L è funzione x in sostanza si vedono meno livelli di colore e diminuisce il dettaglio.
	Quindi pDef grande per aree piccole con molti dettagli, pDef piccolo per aree grandi con pochi dettagli.
*/

page.onConsoleMessage = function(msg) {
  console.log(' ' + msg);
};
page.viewportSize = { width: system.args[1], height : system.args[2] };
page.content = '<html><body><canvas id="surface"></canvas></body></html>';
page.evaluate(function( pWidth, pHeight, pDef, pCr, pCi, pRad, pFileName ) {
	var el 		= document.getElementById('surface'),
		context = el.getContext('2d'),
		width 	= window.innerWidth,
		height 	= window.innerHeight,
		imageData,
		pixels,
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
		this.pot= function( Exp ){
			var A = new Complex( this.r, this.i )
			while ( Exp>1 ) {
				this.mol(A);
				Exp--;
			}
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
			//	(this.Height - this.Py) invece di this.Py perchè le coordinate immagine crescono dall'alto verso il basso
			var i = this.IMin + ( (this.Height - this.Py) / this.Height ) * ( this.IMax - this.IMin );
			return i;
		},
		this.Sx		= function( N, MaxSx ){	//	Valore dell' indice della serie Z( Sx ) = Z( Sx-1 )^N + C per cui | Z(Sx) | > 2.0
			var Sx 		= 0;				//	Indice della serie
			this.Z.r	= 0;				//	Inizializzo Z
			this.Z.i 	= 0;
			//	Calcolo la serie Z( Sx+1 ) = Z( Sx )^N + C
			while( Sx < MaxSx && this.Z.mod() < 2.0 ) {
				this.Z.pot( N );
				this.Z.sum(this.C);
				Sx++;
			};
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
	function hslToRgb(h, s, l, a){
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

		return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), Math.round(a * 255)];
	};

	function mapSx( MinSx, MaxSx, Sx ) {
		if ( Sx > MaxSx )
			return 255;
		if ( Sx < MinSx )
			return 0;
		
		return Math.floor( 255 * ( ( Sx - MinSx ) / ( MaxSx - MinSx ) ) );
	};

	console.log( 'mandelbrot.js' );
	console.log( '	Image size: ' + pWidth + 'x' + pHeight );
	console.log( '	Quality   : ' + pDef );
	console.log( '	Center    : ' + pCr + ', ' + pCi + 'i' );
	console.log( '	Radius    : ' + pRad );
	console.log( '	OutFile   : ' + pFileName );
	
	var MB= new MBSet( pCr, pCi, pRad, width, height );

	var Debug			= false;
	
	var Sx 				= 0;							//	Numero di iterazioni per cui la serie rimane limitata entro Z.mod < 2.0
	var SxMin			= 2;							//		Valore minimo  per mappare Sx da 0 a NumColor. Sx<SxMin => 0
	var SxMax			= pDef;							//		Valore massimo per mappare Sx da 0 a NumColor. Sx<SxMax => NumColor
	
	var NumColor		= 256;							//	Massimo 256 colori per questo tipo di immagine
	var SmpColor		= 0;							//	Campionatura colore (0 - NumColor-1)
	var DeltaSmpColor	= (NumColor/(SxMax-SxMin))/2;	//	Delta tra un livello di colore ed il successivo
	
	var rgba			= [];							//	Array colore RGB
	var dist 			= [];							//	Array conteggi del numero di ogni SmpColor 

	var dstart			= Math.floor( Date.now() / 1000 );
	var dnow			= 0;
	var rsec			= 0;
	var srim			= 0;
	
	el.width  = width;
	el.height = height;
	imageData = context.createImageData(width, height);
	pixels = imageData.data;

	for (y = 0; y < height; y++) {
		
		//	Limitazione a 20 righe di log
		if ( y % (height/20) === 0 ) {
			dnow = Math.floor( Date.now() / 1000 )+1;
			rsec = y/(dnow - dstart);
			srim = Math.floor( (height-y)/rsec );
			console.log( 'Rows: ' + y + '/' + height + ' Sec: ' + (dnow - dstart) + ' Row/Sec: ' + rsec + ' Sec Rim: ' + srim );
		}
		
		for (x = 0; x < width; x++) {

			//	Imposto il punto (x,y) nel grafico
			MB.SetP( x, y );
			
			//	Calcolo il valore di C in funzione del punto (x,y)
			MB.C.r = MB.RAtt();
			MB.C.i = MB.IAtt();

			Sx = MB.Sx( 2, SxMax );
			SmpColor = mapSx( SxMin, SxMax, Sx )

			if ( Debug ) {
				//	Aggiungo un hit a questo SmpColor
				if ( typeof( dist[ SmpColor ] ) === "undefined" ) {
					dist[ SmpColor ] = 1;
				} else {
					dist[ SmpColor ]++;
				}
			}
			
			//	Selezione colore
			if ( SmpColor >= Math.floor(NumColor - DeltaSmpColor) ) {
				rgb = [0,0,0, 255]
			} else {
				if ( SmpColor <= Math.floor(0 + DeltaSmpColor) ) {
					rgb = [255,255,255,255]
				} else {
					rgb = hslToRgb( (SmpColor/255.0), 1.0, 0.5, 1.0 ); 
				}
			}

			//	Inserimento pixel
			pixels[i++] = rgb[0];
			pixels[i++] = rgb[1];
			pixels[i++] = rgb[2];
			pixels[i++] = rgb[3];

		}
	
	}

	if ( Debug ) {
		//	Visualizzazione array con il numero di hit per ogni SmpColor
		for (SmpColor = 0; SmpColor < NumColor; SmpColor++) {
			console.log( SmpColor + ';' + ( typeof( dist[ SmpColor ] ) !== "undefined" ? dist[ SmpColor ] + ';' + 100*dist[ SmpColor ]/(width*height) + '%' : '0;0%' ) );
		}
	}
	
	context.putImageData(imageData, 0, 0);
	document.body.style.backgroundColor = 'white';
	document.body.style.margin = '0px';
	
}, pWidth, pHeight, pDef, pCr, pCi, pRad, pFileName 	//	Parametri page.evaluate
);

page.render(pFileName);

phantom.exit();

