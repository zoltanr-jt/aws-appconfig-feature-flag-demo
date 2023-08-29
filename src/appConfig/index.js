import {AppConfigDataClient, BadRequestException, GetLatestConfigurationCommand, StartConfigurationSessionCommand}
    from "@aws-sdk/client-appconfigdata";

// General Constants
const region = process.env.REACT_APP_AWS_REGION;
const appIdentifier = process.env.REACT_APP_APP_CONFIG_APP_IDENTIFIER;
const profileIdentifier = process.env.REACT_APP_APP_CONFIG_CONFIG_PROFILE_IDENTIFIER;
const envIdentifier = process.env.REACT_APP_APP_CONFIG_ENVIRONMENT_IDENTIFIER;

// General Variables
let app = {
    flags: undefined
};
let existingToken;
let credentials = {
    accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY,
    //sessionToken: process.env.REACT_APP_AWS_SESSION_TOKEN
}
// AppConfig client (which can be shared by different commands).
const client = new AppConfigDataClient({ region: region, credentials });

// Parameters for the command.
const startConfigurationSessionCommand = {
    ApplicationIdentifier: appIdentifier,
    ConfigurationProfileIdentifier: profileIdentifier,
    EnvironmentIdentifier: envIdentifier
};

// New instance for getting an AppConfig session token.
const getSession = new StartConfigurationSessionCommand(startConfigurationSessionCommand);

// Get AppConfig token.
async function getToken() {

    try {

        const sessionToken = await client.send(getSession);

        return sessionToken.InitialConfigurationToken || "";

    } catch (error) {

        console.error(error);

        throw error;

    } finally {
        console.info("complete");
    }

}

// Get all feature flags for this application and environment.
function getFeatureFlags() {

    async function _asyncFeatureFlags() {

        if (!existingToken) {

            existingToken = await getToken();
            console.log("existingToken: ", existingToken   );

        }

        try {

            // Paramaters for the command.
            const getLatestConfigurationCommand = {
                ConfigurationToken: existingToken,
                NextPollIntervalInSeconds:11

            };

            // Get the lastest configuration.
            const getConfiguration = new GetLatestConfigurationCommand(getLatestConfigurationCommand);

            // Get the configuration.
            const response = await client.send(getConfiguration);

            if (response.Configuration) {

                // The configuration comes back as as set of character codes.
                // Need to convert the character codes into a string.
                let configuration = "";

                for (let i = 0; i < response.Configuration.length; i++) {
                    configuration += String.fromCharCode(response.Configuration[i]);
                }

                const allFlags = JSON.parse(configuration);

                // @ts-ignore
                app.flags = Object.assign({}, allFlags);

            }

        } catch (error) {

            if (error instanceof BadRequestException) {

                console.error(error);

                existingToken = await getToken();

                return _asyncFeatureFlags();

            } else {

                throw error;

            }

        } finally {

            // console.info("complete");

        }

    }

    return _asyncFeatureFlags();

}

// Get a single feature flag.
export function getFeatureFlag(flag) {

    if (app.flags && flag) {

        return app.flags[flag];

    } else {

        return {};

    }

}

// Initialize the application.
export const init = () => {

    // Fail the initialization if the promises fail.
    function _failure(error) {

        console.error(error);
        return;

    }

    // Any promises that need to be resolved first should be done in the initialization (init) function.
    Promise.all([
        getFeatureFlags()
    ]).then(main,_failure);

}

function main() {

    console.log("header: " + JSON.stringify(getFeatureFlag("proba3")));
    console.log("footer: " + JSON.stringify(app.flags.footer));
    console.log("short-term-feature: " + JSON.stringify(getFeatureFlag("short-term-feature")));

}

