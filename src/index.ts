#!/usr/bin/env node

import { resolve } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { spawn } from 'child_process'

const pkgFilePath = resolve(process.cwd(), 'package.json')
const backupFilePath = resolve(process.cwd(), 'package.json.backup')

const bumpLibs = async (dependencies: { [k: string]: string }, npmFlags = '') => new Promise((resolve) => {
    const dependenciesList = Object.keys(dependencies)
    const uninstall = spawn('npm', ['uninstall', ...dependenciesList])
    uninstall.stdout.on('data', (data) => {
        console.log(`uninstall: ${data}`)
    })
    uninstall.on('close', (code) => {
        console.log(`uninstall: child process exited with code ${code}`);
        const reinstall = spawn('npm', ['install', ...dependenciesList, npmFlags])
        reinstall.stdout.on('data', (data) => {
            console.log(`reinstall: ${data}`)
        })
        reinstall.on('close', (code) => {
            console.log(`reinstall: child process exited with code ${code}`)
            verify(npmFlags)
            resolve(true)
        })
    })
})

const loadPkgObj = () => JSON.parse(readFileSync(pkgFilePath).toString())
let originalPkgObj

const verify = (npmFlags) => {
    const { dependencies = {}, devDependencies = {} } = originalPkgObj
    const { dependencies: updatedLibs = {}, devDependencies: updatedDevLibs = {} } = loadPkgObj()

    if (!npmFlags.includes('--save-dev') && Object.keys(dependencies).length && Object.keys(updatedLibs).length) {
        const touchedDependencies = Object.keys(dependencies).filter(d => dependencies[d] !== updatedLibs[d]).map(d => `${d} ${dependencies[d]} --> ${updatedLibs[d]}`)
        if (touchedDependencies.length) console.log('\n🏁\tUPDATED libs...\n\n', touchedDependencies.join('\n'))
        else console.log('\n✅\tDependencies up-to-date\n')
    }

    if (npmFlags.includes('--save-dev') && Object.keys(devDependencies).length && Object.keys(updatedDevLibs).length) {
        const touchedDevDependencies = Object.keys(devDependencies).filter(d => devDependencies[d] !== updatedDevLibs[d]).map(d => `${d} ${devDependencies[d]} --> ${updatedDevLibs[d]}`)
        if (touchedDevDependencies.length) console.log('\n🏁\tUPDATED DEV-libs...\n\n', touchedDevDependencies.join('\n'))
        else console.log('\n✅\tDEV-Dependencies up-to-date\n')
    }
}

const bumpPkgLibs = async (dependencies, devDependencies) => {
    if (Object.keys(dependencies).length) {
        await bumpLibs(dependencies)
    }
    if (Object.keys(devDependencies).length) {
        await bumpLibs(devDependencies, '--save-dev')
    }
}

try {
    originalPkgObj = loadPkgObj()
    const { dependencies = {}, devDependencies = {} } = originalPkgObj
    if (dependencies?.bumplibs) delete dependencies['bumplibs']
    if (devDependencies?.bumplibs) delete devDependencies['bumplibs']
    writeFileSync(backupFilePath, JSON.stringify(originalPkgObj, null, 4))
    console.log('\n\n⤴️\tUPDATING libs...\n\n', JSON.stringify({ dependencies, devDependencies }, null, 4))

    bumpPkgLibs(dependencies, devDependencies)

} catch (error) {
    console.error({ error })
}
