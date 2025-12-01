import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    webpack: config => {
        config.module.rules.push({
            test: /\.ttf$/i,
            use: [
                {
                    loader: require('path').resolve(__dirname, 'loaders/ttf-buffer-loader.js'),
                },
            ],
        });

        return config;
    }
};

export default nextConfig;
