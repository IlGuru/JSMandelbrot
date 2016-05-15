"use strict";
var page = require('webpage').create();
var system = require('system');

if (system.args.length !== 8) {
    console.log('phantomjs mandelbrot.js Cr Ci Rad Width Height NumColor MinIteration MaxIteration FileName.png');
};

var pCr				= ( typeof(system.args[1])	=== 'undefined' ? -0.5 	: parseFloat(system.args[1]));	//	Centro del grafico, valore reale
var pCi				= ( typeof(system.args[2])	=== 'undefined' ? 0.0 	: parseFloat(system.args[2]));	//	Centro del grafico, valore immaginario
var pRad 			= ( typeof(system.args[3])	=== 'undefined' ? 1.5 	: parseFloat(system.args[3]));	//	Raggio del grafico
var pWidth 			= ( typeof(system.args[4])	=== 'undefined' ? 600 	: parseInt(  system.args[4]));	//	Dimensioni x immagine
var pHeight			= ( typeof(system.args[5])	=== 'undefined' ? 600 	: parseInt(  system.args[5]));	//	Dimensioni y immagine
var pNumColor		= ( typeof(system.args[6])	=== 'undefined' ? 256 	: parseInt(  system.args[6]));	//	Numero di colori
var pMinIteration	= ( typeof(system.args[7])	=== 'undefined' ? 1 	: parseInt(  system.args[7]));	//	Numero di iterazioni minimo da disegnare
var pMaxIteration 	= ( typeof(system.args[8])	=== 'undefined' ? 32 	: parseInt(  system.args[8]));	//	Numero di iterazioni massimo da disegnare
var pFileName 		= ( typeof(system.args[9])	=== 'undefined' ? 'mandelbrot' + '_(' + pCr + '_' + pCi + '_' + pRad + ')_(' + pWidth + 'x' + pHeight + '@' + pNumColor + ')' + '(' + pMinIteration + ',' + pMaxIteration + ').png' : system.args[9] );

/*
	pMaxIteration:
	Aumentare la pMaxIteration è utile quando si osservano zone molto ristrette, altrimenti si vedono meno livelli.
	pMaxIteration è il numero massimo di iterazioni x della funzione Z(x) = Z(x-1)^2 + C
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
	0                     pMaxIteration
	Quindi aumentare il numero pMaxIteration significa che poi rimappando le x nei livelli di colore L da 0 a 256 
		si raggruppano tutti i valori più bassi L in un valore solo.
	Poichè un L è funzione x in sostanza si vedono meno livelli di colore e diminuisce il dettaglio.
	Quindi pMaxIteration grande per aree piccole con molti dettagli, pMaxIteration piccolo per aree grandi con pochi dettagli.
*/

page.onConsoleMessage = function(msg) {
  console.log(' ' + msg);
};
page.viewportSize = { width: pWidth, height : pHeight };
page.content = '<html><body><canvas id="surface"></canvas></body></html>';
page.evaluate(function( pCr, pCi, pRad, pWidth, pHeight, pNumColor, pMinIteration, pMaxIteration, pFileName ) {
	var el 		= document.getElementById('surface'),
		context = el.getContext('2d'),
		width 	= window.innerWidth,
		height 	= window.innerHeight,
		imageData,
		pixels,
		i = 0, x, y;
		
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

	function mapSx( MinSx, MaxSx, Sx, MaxColor ) {
		//Ritorna un valore tra 0 e MaxColor per Sx tra MinSx e MaxSx
		//	(MinSx<->MaxSx) -> (0<->MaxColor)
		if ( Sx >= MaxSx )
			return MaxColor;
		if ( Sx <= MinSx )
			return 0;
		
		return Math.floor( MaxColor * ( ( Sx - MinSx ) / ( MaxSx - MinSx ) ) );
	};

	FormatNum = function( n, p, d ) {
		return String("        " + n.toFixed(d)).slice(-p);
	};
	
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

	LOG = function( PixMax, dStart ){
		this.iPix		= 0,
		this.iPixMax	= PixMax,
		this.dstart		= Math.floor( dStart / 1000 ),
		this.iMaxLog	= 5*Math.pow( 10, Math.floor(Math.log(PixMax) / Math.LN10)-4),
		this.iPixMod	= Math.floor(PixMax/this.iMaxLog);
		this.dnow		= 0,
		this.uptime		= 0,
		this.psec		= 0,
		this.srim		= 0,
		this.doLog		= function(){
			this.iPix++;
			if ( (this.iPix % this.iPixMod) === 0 ) {
				this.dnow	= Math.floor( Date.now() / 1000 );
				this.uptime	= this.dnow - this.dstart;
				this.psec	= this.iPix/this.uptime;
				this.srim	= Math.floor( (this.iPixMax-this.iPix)/this.psec );
				var sec 	= this.srim % 60;
				var min		= ((this.srim - sec) / 60 ) % 60
				var hh		= ((this.srim - sec - min*60) / 3600 ) % 24;
				var dd		= ((this.srim - sec - min*60 - hh*3600) / 86400 );
				console.log( 'Pix: ' + FormatNum(this.iPix, 8, 0) + '/' + this.iPixMax + ' - Sec: ' + FormatNum(this.uptime, 8, 0) + ' - Pix/Sec: ' + FormatNum(this.psec, 12, 3) + ' - TTE: ' + ( dd != 0 ? FormatNum( dd, 2, 0 ) + 'D ' : '') + ( hh != 0 ? FormatNum( hh, 2, 0 ) + ':' : '') + FormatNum( min, 2, 0 ) + ':' + FormatNum( sec, 2, 0 ) );
			};
		};
	};
		
	console.log( 'mandelbrot.js' );
	console.log( '	Image size: ' + pWidth + 'x' + pHeight );
	console.log( '	Colors    : ' + pNumColor );
	console.log( '	Iteration : ' + pMinIteration + '->' + pMaxIteration );
	console.log( '	Center    : ' + pCr + ', ' + pCi + 'i' );
	console.log( '	Radius    : ' + pRad );
	console.log( '	OutFile   : ' + pFileName );
	
	var MB= new MBSet( pCr, pCi, pRad, width, height );

	var Debug			= false;
	
	var Sx 				= 0;											//	Numero di iterazioni per cui la serie rimane limitata entro Z.mod < 2.0
	
	var SmpColor		= 0;											//	Campionatura colore (0 - pNumColor-1)
	var DeltaSmpColor	= (pNumColor/(pMaxIteration-pMinIteration))/2;	//	Delta tra un livello di colore ed il successivo
	
	var rgba			= [];											//	Array colore RGB
	var Palette 		= [];											//	Array conteggi del numero di ogni SmpColor 

	el.width  = width;
	el.height = height;
	imageData = context.createImageData(width, height);
	pixels = imageData.data;

	var L = new LOG( height*width, Date.now() );
	console.log( 'Max log: ' + L.iMaxLog );
	for ( y = 0; y < height; y++) {
		
		for (x = 0; x < width; x++) {

			//	Log
			L.doLog();
			
			//	Imposto il punto (x,y) nel grafico
			MB.SetP( x, y );
			
			//	Calcolo il valore di C in funzione del punto (x,y)
			MB.C.r = MB.RAtt();
			MB.C.i = MB.IAtt();

			Sx = MB.Sx( 2, pMaxIteration );
			SmpColor = mapSx( pMinIteration, pMaxIteration, Sx, pNumColor );

			//	Selezione colore dalla palette
			if ( typeof( Palette[ SmpColor ] ) === "undefined" ) {
				//	Selezione colore
				if ( SmpColor >= Math.floor(pNumColor - DeltaSmpColor) ) {
					rgb = [0,0,0, 255]
				} else {
					if ( SmpColor <= Math.floor(0 + DeltaSmpColor) ) {
						rgb = [255,255,255,255]
					} else {
						rgb = hslToRgb( (SmpColor/(pNumColor-1)), 1.0, 0.5, 1.0 ); 
					};
				};
				//	Aggiungo questo SmpColor nella pelette
				Palette[ SmpColor ] = {
					Hit: 1,
					R: rgb[0],
					G: rgb[1],
					B: rgb[2],
					A: rgb[3]
				};
			} else {
				//	Aggiungo un hit
				Palette[ SmpColor ].Hit++;
			};
			
			//	Inserimento pixel
			pixels[i++] = Palette[ SmpColor ].R;
			pixels[i++] = Palette[ SmpColor ].G;
			pixels[i++] = Palette[ SmpColor ].B;
			pixels[i++] = Palette[ SmpColor ].A;

		}
	
	}

	if ( Debug ) {
		//	Visualizzazione array con il numero di hit per ogni SmpColor
		for (SmpColor = 0; SmpColor < pNumColor; SmpColor++) {
			console.log( SmpColor + ';' + ( typeof( Palette[ SmpColor ] ) !== "undefined" ? Palette[ SmpColor ].Hit + ';' + 100*Palette[ SmpColor ].Hit/(width*height) + '%' : '0;0%' ) );
		}
	}
	
	context.putImageData(imageData, 0, 0);
	document.body.style.backgroundColor = 'white';
	document.body.style.margin = '0px';
	
}, pCr, pCi, pRad, pWidth, pHeight, pNumColor, pMinIteration, pMaxIteration, pFileName 	//	Parametri page.evaluate
);

page.render(pFileName);

phantom.exit();