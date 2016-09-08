#DEPRECIADO 

# Mba.ux.GoogleAnalytics
Plugin para integração com o GoogleAnalytics

Exemplo de uso:

Na classe app.js:

    launch: function() {
        Ext.USE_NATIVE_JSON = true;
        // Utilizar o método initialize passando como parâmetro a chave do Google Analytics
        mbaGA.initialize('UA-72432132-2');
        //Utilizar o método trackPageview para criar um registro de monitoramento no Google Analytics
        //Pode ser utilizada a URL que desejar. Sugestão: utilizar /mobile/ para identificar as páginas que vem no mobile.
        mbaGA.trackPageview('/mobile/index.html', 'Inicio');
        // Initialize the main view
        Ext.Viewport.add(Ext.create('IsfGestor.view.Login'));
    },
